import { Component, ChangeDetectionStrategy, inject, signal, input, effect, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
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
  private route = inject(ActivatedRoute);
  private firestore = inject(FirestoreService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild('fieldModal') fieldModalTemplate!: TemplateRef<any>;

  currentStep = signal<number>(1);
  countryId = signal<string | null>(null); // Passed from route
  selectedCountry = signal<CountryConfig | null>(null); // Full config object
  isSaving = signal(false); // For overall wizard save operation

  editingFieldIndex = signal<number | null>(null); // For managing salary fields
  globalCountries = GLOBAL_COUNTRIES; // For ng-select

  // Form for country details and salary fields (Step 1)
  countryForm = this.fb.group({
    countryName: ['', Validators.required],
    countryCode: ['', Validators.required],
    fields: this.fb.array([], Validators.minLength(1)) // For salary fields
  });

  // Form for adding/editing a single salary field
  fieldEditForm = this.fb.group({
    id: ['', Validators.required],
    name: ['', Validators.required],
    type: ['numeric', Validators.required]
  });

  constructor() {
    // Effect to load country data when countryId changes (from route)
    effect(() => {
      const id = this.countryId();
      if (id && id !== 'new') {
        this.loadCountryConfig(id);
      } else {
        // Reset form for new country
        this.countryForm.reset({ countryName: '', countryCode: '' });
        this.fields.clear();
      }
    });

    // Subscribe to route params to get countryId
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.countryId.set(id);
      }
    });
  }

  // --- Step 1 related methods ---

  loadCountryConfig(id: string) {
    this.firestore.getDocument<CountryConfig>('countryConfigs', id)
      .pipe(take(1), filter(Boolean))
      .subscribe(config => {
        this.selectedCountry.set(config);
        this.countryForm.patchValue({
          countryName: config.countryName,
          countryCode: config.countryCode
        });
        this.fields.clear();
        config.fields.forEach(f => {
          this.fields.push(this.fb.group({
            id: [f.id, Validators.required],
            name: [f.name, Validators.required],
            type: [f.type, Validators.required]
          }));
        });
      });
  }

  get fields() {
    return this.countryForm.get('fields') as FormArray;
  }

  onCountrySelect(country: any) {
    if (country) {
      this.countryForm.patchValue({
        countryName: country.name,
        countryCode: country.code
      });
    } else {
      this.countryForm.patchValue({
        countryName: '',
        countryCode: ''
      });
    }
  }

  openFieldModal(index: number | null = null) {
    this.editingFieldIndex.set(index);
    if (index !== null) {
      this.fieldEditForm.patchValue(this.fields.at(index).getRawValue());
    } else {
      this.fieldEditForm.reset({ type: 'numeric' });
    }
    this.modal.open({
      title: index !== null ? 'Edit Salary Field' : 'Add Salary Field',
      template: this.fieldModalTemplate,
      size: 'sm'
    });
  }

  saveField() {
    if (this.fieldEditForm.invalid) {
      this.fieldEditForm.markAllAsTouched();
      return;
    }
    
    const fieldVal = this.fieldEditForm.getRawValue();
    const index = this.editingFieldIndex();

    if (index !== null) {
      this.fields.at(index).patchValue(fieldVal);
    } else {
      this.fields.push(this.fb.group({
        id: [fieldVal.id, Validators.required],
        name: [fieldVal.name, Validators.required],
        type: [fieldVal.type, Validators.required]
      }));
    }
    this.modal.close();
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  // --- Wizard Navigation & Overall Save ---

  setStep(step: number) {
    if (step < 1 || step > 3) return;
    this.currentStep.set(step);
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
      const config = this.countryForm.getRawValue() as CountryConfig;
      const id = this.countryId();
      
      if (id && id !== 'new') {
        await this.firestore.updateDocument('countryConfigs', id, config);
        this.toast.success('Country schema updated successfully.');
        this.selectedCountry.set(config); // Update selectedCountry with latest data
      } else {
        const result = await this.firestore.addDocument('countryConfigs', config);
        this.toast.success('Country schema created successfully.');
        this.router.navigate(['/manage-country', result.id]); // Navigate to edit mode
      }
    } catch (error: any) {
      console.error('Firestore Save Error:', error);
      this.toast.error(error.message || 'Save operation failed. Please check your connection.');
    } finally {
      this.isSaving.set(false);
    }
  }

  getFlagUrl(code: string | null | undefined) {
    if (!code) return '';
    const country = GLOBAL_COUNTRIES.find(c => c.code === code || c.iso2 === code);
    const iso2 = country?.iso2 || code;
    return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
  }

  getCountryByCode(code: string | null | undefined) {
    if (!code) return undefined;
    return GLOBAL_COUNTRIES.find(c => c.code === code);
  }
}
