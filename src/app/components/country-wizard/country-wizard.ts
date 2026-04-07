import { Component, ChangeDetectionStrategy, inject, signal, input, effect, ViewChild, TemplateRef, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { CountryConfig } from '../../models/country-config.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { GeoGroupsComponent } from '../geo-groups/geo-groups';
import { RuleConfigComponent } from '../rule-config/rule-config';
import { NgSelectModule } from '@ng-select/ng-select';
import { take, filter } from 'rxjs';

@Component({
  selector: 'app-country-wizard',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, NgSelectModule, GeoGroupsComponent, RuleConfigComponent],
  templateUrl: './country-wizard.html',
  styleUrl: './country-wizard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountryWizardComponent {
  private activatedRoute = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private changeDetectorRef = inject(ChangeDetectorRef);
  modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild('fieldModal') fieldModalTemplate!: TemplateRef<any>;

  currentStep = signal<number>(1);
  countryId = signal<string | null>(null); // Passed from route
  selectedCountry = signal<CountryConfig | null>(null); // Full config object
  isSaving = signal(false); // For overall wizard save operation

  editingFieldIndex = signal<number | null>(null); // For managing salary fields
  globalCountries = GLOBAL_COUNTRIES; // For ng-select

  // Signal to track FormArray controls for robust UI updates
  fieldsSignal = signal<FormGroup[]>([]);

  // Form for country details and salary fields (Step 1)
  countryForm = this.formBuilder.group({
    countryName: ['', Validators.required],
    countryCode: ['', Validators.required],
    fields: this.formBuilder.array([], Validators.minLength(1)) // For salary fields
  });

  // Form for adding/editing a single salary field
  fieldEditForm = this.formBuilder.group({
    id: ['', Validators.required],
    name: ['', Validators.required],
    type: ['numeric', Validators.required]
  });

  constructor() {
    // Effect to load country data when countryId changes (from route)
    effect(() => {
      const currentCountryId = this.countryId();
      if (currentCountryId && currentCountryId !== 'new') {
        this.loadCountryConfig(currentCountryId);
      } else {
        // Reset form for new country, but check query params first
        const queryParameters = this.activatedRoute.snapshot.queryParams;
        this.countryForm.reset({ 
          countryName: queryParameters['name'] || '', 
          countryCode: queryParameters['code'] || '' 
        });
        this.fields.clear();
        this.updateFieldsSignal();
      }
    });

    // Subscribe to route params to get countryId
    this.activatedRoute.params.subscribe(parameters => {
      const currentCountryId = parameters['id'];
      if (currentCountryId) {
        this.countryId.set(currentCountryId);
      }
    });
  }

  // --- Step 1 related methods ---

  loadCountryConfig(countryConfigId: string) {
    this.firestore.getDocument<CountryConfig>('countryConfigs', countryConfigId)
      .pipe(take(1), filter(Boolean))
      .subscribe(countryConfig => {
        this.selectedCountry.set(countryConfig);
        this.countryForm.patchValue({
          countryName: countryConfig.countryName,
          countryCode: countryConfig.countryCode
        });
        this.fields.clear();
        countryConfig.fields.forEach(field => {
          this.fields.push(this.formBuilder.group({
            id: [field.id, Validators.required],
            name: [field.name, Validators.required],
            type: [field.type, Validators.required]
          }));
        });
        this.updateFieldsSignal();
      });
  }

  get fields() {
    return this.countryForm.get('fields') as FormArray;
  }

  private updateFieldsSignal() {
    this.fieldsSignal.set([...this.fields.controls] as FormGroup[]);
    this.changeDetectorRef.markForCheck();
  }

  onCountrySelect(countryOption: any) {
    if (countryOption) {
      this.countryForm.patchValue({
        countryName: countryOption.name,
        countryCode: countryOption.code
      });
    } else {
      this.countryForm.patchValue({
        countryName: '',
        countryCode: ''
      });
    }
    this.changeDetectorRef.markForCheck();
  }

  openFieldModal(fieldIndex: number | null = null) {
    this.editingFieldIndex.set(fieldIndex);
    if (fieldIndex !== null) {
      this.fieldEditForm.patchValue(this.fields.at(fieldIndex).getRawValue());
    } else {
      this.fieldEditForm.reset({ type: 'numeric' });
    }
    this.modal.open({
      title: fieldIndex !== null ? 'Edit Salary Field' : 'Add Salary Field',
      template: this.fieldModalTemplate,
      size: 'sm'
    });
  }

  saveField() {
    if (this.fieldEditForm.invalid) {
      this.fieldEditForm.markAllAsTouched();
      return;
    }
    
    const fieldValue = this.fieldEditForm.getRawValue();
    const fieldIndex = this.editingFieldIndex();

    if (fieldIndex !== null) {
      this.fields.at(fieldIndex).patchValue(fieldValue);
    } else {
      this.fields.push(this.formBuilder.group({
        id: [fieldValue.id, Validators.required],
        name: [fieldValue.name, Validators.required],
        type: [fieldValue.type, Validators.required]
      }));
    }
    this.updateFieldsSignal();
    this.modal.close();
  }

  removeField(fieldIndex: number) {
    this.fields.removeAt(fieldIndex);
    this.updateFieldsSignal();
  }

  // --- Wizard Navigation & Overall Save ---

  setStep(stepNumber: number) {
    if (stepNumber < 1 || stepNumber > 3) return;
    this.currentStep.set(stepNumber);
    this.changeDetectorRef.markForCheck();
  }

  async next() {
    // Validation for Step 1 before moving to next step
    if (this.currentStep() === 1) {
      this.countryForm.markAllAsTouched();
      if (this.countryForm.invalid) {
        if (this.fields.length === 0) {
          this.toast.error('Please add at least one salary field to the schema.');
        } else {
          this.toast.error('Please fill in all required country details.');
        }
        this.changeDetectorRef.markForCheck();
        return;
      }
      await this.saveCountryDetails(); // Save step 1 data before proceeding
      if (this.isSaving()) return; // If save is still in progress or failed, don't proceed
    }
    this.setStep(this.currentStep() + 1);
  }

  back() {
    this.setStep(this.currentStep() - 1);
  }

  closeWizard() {
    this.router.navigate(['/countries']);
  }

  async saveCountryDetails() {
    try {
      this.isSaving.set(true);
      this.changeDetectorRef.markForCheck();
      const countryConfig = this.countryForm.getRawValue() as CountryConfig;
      const currentCountryId = this.countryId();
      
      if (currentCountryId && currentCountryId !== 'new') {
        await this.firestore.updateDocument('countryConfigs', currentCountryId, countryConfig);
        this.toast.success('Country schema updated successfully.');
        this.selectedCountry.set(countryConfig); // Update selectedCountry with latest data
      } else {
        const result = await this.firestore.addDocument('countryConfigs', countryConfig);
        this.toast.success('Country schema created successfully.');
        this.router.navigate(['/manage-country', result.id]); // Navigate to edit mode
      }
    } catch (error: any) {
      console.error('Firestore Save Error:', error);
      this.toast.error(error.message || 'Save operation failed. Please check your connection.');
    } finally {
      this.isSaving.set(false);
      this.changeDetectorRef.markForCheck();
    }
  }

  getFlagUrl(countryCode: string | null | undefined) {
    if (!countryCode) return '';
    const countryItem = GLOBAL_COUNTRIES.find(country => country.code === countryCode || country.iso2 === countryCode);
    const isoCode = countryItem?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }

  getCountryByCode(countryCode: string | null | undefined) {
    if (!countryCode) return undefined;
    return GLOBAL_COUNTRIES.find(countryItem => countryItem.code === countryCode);
  }
}
