import { Component, ChangeDetectionStrategy, inject, input, effect, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { CountryConfig } from '../../models/country-config.model';
import { GeoGroup } from '../../models/geo-group.model';
import { Contribution, ContributionType } from '../../models/contribution.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { take, map, switchMap, of } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-rule-config',

  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './rule-config.html',
  styleUrl: './rule-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleConfigComponent {
  private formBuilder = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  protected modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild('setModal') setModalTemplate!: TemplateRef<any>;
  @ViewChild('manageRulesModal') manageRulesModalTemplate!: TemplateRef<any>;

  ContributionType = ContributionType;
  countryCode = input<string | null | undefined>(null);
  selectedCountry = signal<CountryConfig | null>(null);
  isSaving = signal(false);
  
  showConfirmDelete = signal<string | null>(null);
  activeContribution = signal<Contribution | null>(null);
  showStrategyForm = signal(false);
  editingStrategyIndex = signal<number | null>(null);

  geoGroups$ = toObservable(this.countryCode).pipe(
    switchMap(currentCountryCode => {
      if (!currentCountryCode) return of([]);
      return this.firestore.getCollection<GeoGroup>('geoGroups').pipe(
        map(geoGroups => geoGroups.filter(geoGroup => geoGroup.countryCode === currentCountryCode))
      );
    })
  );

  contributions$ = toObservable(this.countryCode).pipe(
    switchMap(currentCountryCode => {
      if (!currentCountryCode) return of([]);
      return this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', currentCountryCode);
    })
  );

  setForm = this.formBuilder.group({
    name: ['', Validators.required]
  });

  strategyForm = this.formBuilder.group({
    name: ['', Validators.required],
    type: [ContributionType.Employer, Validators.required],
    effectiveFrom: [new Date().toISOString().split('T')[0], Validators.required],
    geoGroupId: ['', Validators.required],
    slabs: this.formBuilder.array([])
  });

  constructor() {
    effect(() => {
      const currentCountryCode = this.countryCode();
      if (currentCountryCode) {
        this.loadCountrySchema(currentCountryCode);
      }
    });
  }

  loadCountrySchema(currentCountryCode: string) {
    this.firestore.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', currentCountryCode)
      .pipe(take(1))
      .subscribe(countryConfigs => {
        if (countryConfigs.length > 0) {
          this.selectedCountry.set(countryConfigs[0]);
        }
      });
  }

  get slabs() {
    return this.strategyForm.get('slabs') as FormArray;
  }

  addSlab(initialData?: any) {
    const slabFormGroup = this.formBuilder.group({
      minimum: [initialData?.minimum ?? 0, Validators.required],
      maximum: [initialData?.maximum ?? 9999999, Validators.required],
      valueSourceFieldId: [initialData?.valueSourceFieldId ?? '', Validators.required],
      calculationType: [initialData?.calculationType ?? 'Percentage', Validators.required],
      value: [initialData?.value ?? 0, Validators.required],
      ceiling: [initialData?.ceiling ?? 0],
      wageTypeFieldId: [initialData?.wageTypeFieldId ?? '', Validators.required]
    });
    this.slabs.push(slabFormGroup);
  }

  openCreateModal() {
    this.setForm.reset();
    this.modal.open({
      title: 'Define contribution set',
      size: 'sm',
      template: this.setModalTemplate
    });
  }

  async saveSet() {
    if (this.setForm.invalid || this.isSaving()) return;
    
    try {
      this.isSaving.set(true);
      const contribution: Partial<Contribution> = {
        name: this.setForm.get('name')?.value!,
        countryCode: this.countryCode()!,
        rules: []
      };
      await this.firestore.addDocument('contributions', contribution);
      this.modal.close();
      this.toast.success('Contribution set created successfully.');
    } catch (error: any) {
      console.error('Error saving contribution set:', error);
      this.toast.error(error.message || 'Error saving contribution set.');
    } finally {
      this.isSaving.set(false);
    }
  }

  openManageRules(contribution: Contribution) {
    this.activeContribution.set(contribution);
    this.showStrategyForm.set(false);
    this.modal.open({
      title: `Strategies: ${contribution.name}`,
      side: 'right',
      template: this.manageRulesModalTemplate
    });
  }

  toggleStrategyForm(ruleIndex: number | null = null) {
    this.editingStrategyIndex.set(ruleIndex);
    this.slabs.clear();

    if (ruleIndex !== null) {
      const ruleStrategy = this.activeContribution()?.rules[ruleIndex];
      if (ruleStrategy) {
        this.strategyForm.patchValue({
          name: ruleStrategy.name,
          type: ruleStrategy.type,
          effectiveFrom: ruleStrategy.effectiveFrom,
          geoGroupId: ruleStrategy.geoGroupId
        });
        ruleStrategy.slabs.forEach(slab => this.addSlab(slab));
      }
    } else {
      this.strategyForm.reset({
        type: ContributionType.Employer,
        effectiveFrom: new Date().toISOString().split('T')[0]
      });
      this.addSlab();
    }
    this.showStrategyForm.set(true);
  }

  async saveStrategy() {
    if (this.strategyForm.invalid || !this.activeContribution() || this.isSaving()) return;

    try {
      this.isSaving.set(true);
      const contribution = this.activeContribution()!;
      const ruleStrategy = this.strategyForm.getRawValue();
      const ruleIndex = this.editingStrategyIndex();
      
      const updatedRules = [...(contribution.rules || [])];
      
      if (ruleIndex !== null) {
        updatedRules[ruleIndex] = ruleStrategy as any;
      } else {
        updatedRules.push(ruleStrategy as any);
      }

      await this.firestore.updateDocument('contributions', contribution.id!, { rules: updatedRules });
      
      this.activeContribution.set({ ...contribution, rules: updatedRules });
      this.showStrategyForm.set(false);
      this.toast.success('Rule strategy saved successfully.');
    } catch (error: any) {
      console.error('Error saving rule strategy:', error);
      this.toast.error(error.message || 'Error saving rule strategy.');
    } finally{
      this.isSaving.set(false);
    }
  }

  async removeStrategy(ruleIndex: number) {
    this.modal.confirm({
      title: 'Remove strategy',
      message: 'Are you sure you want to remove this rule strategy?',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        const contribution = this.activeContribution()!;
        const updatedRules = [...contribution.rules];
        updatedRules.splice(ruleIndex, 1);
        
        await this.firestore.updateDocument('contributions', contribution.id!, { rules: updatedRules });
        this.activeContribution.set({ ...contribution, rules: updatedRules });
      }
    });
  }

  requestDelete(contributionId: string) {
    this.modal.confirm({
      title: 'Archive set',
      message: 'Archiving this contribution set removes it from the active payroll processor immediately.',
      confirmLabel: 'Archive rule set',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(contributionId)
    });
  }

  async confirmDelete(contributionId: string) {
    await this.firestore.deleteDocument('contributions', contributionId);
  }

  closeModal() {
    this.modal.close();
  }

  getFlagUrl(countryCode: string | null | undefined) {
    if (!countryCode) return '';
    const country = GLOBAL_COUNTRIES.find(currentCountry => currentCountry.code === countryCode || currentCountry.iso2 === countryCode);
    const isoCode = country?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }
}
