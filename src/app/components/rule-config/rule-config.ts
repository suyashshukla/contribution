import { Component, ChangeDetectionStrategy, inject, input, effect, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { CountryConfig } from '../../models/country-config.model';
import { GeoGroup } from '../../models/geo-group.model';
import { Contribution } from '../../models/contribution.model';
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
  private fb = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  protected modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild('setModal') setModalTemplate!: TemplateRef<any>;
  @ViewChild('manageRulesModal') manageRulesModalTemplate!: TemplateRef<any>;

  countryCode = input<string | null | undefined>(null);
  selectedCountry = signal<CountryConfig | null>(null);
  isSaving = signal(false);
  
  showConfirmDelete = signal<string | null>(null);
  activeContribution = signal<Contribution | null>(null);
  showStrategyForm = signal(false);
  editingStrategyIndex = signal<number | null>(null);

  geoGroups$ = toObservable(this.countryCode).pipe(
    switchMap(code => {
      if (!code) return of([]);
      return this.firestore.getCollection<GeoGroup>('geoGroups').pipe(
        map(groups => groups.filter(g => g.countryCode === code))
      );
    })
  );

  contributions$ = toObservable(this.countryCode).pipe(
    switchMap(code => {
      if (!code) return of([]);
      return this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', code);
    })
  );

  setForm = this.fb.group({
    name: ['', Validators.required]
  });

  strategyForm = this.fb.group({
    name: ['', Validators.required],
    type: ['Employer', Validators.required],
    effectiveFrom: [new Date().toISOString().split('T')[0], Validators.required],
    geoGroupId: ['', Validators.required],
    slabs: this.fb.array([])
  });

  constructor() {
    effect(() => {
      const code = this.countryCode();
      if (code) {
        this.loadCountrySchema(code);
      }
    });
  }

  loadCountrySchema(code: string) {
    this.firestore.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', code)
      .pipe(take(1))
      .subscribe(configs => {
        if (configs.length > 0) {
          this.selectedCountry.set(configs[0]);
        }
      });
  }

  get slabs() {
    return this.strategyForm.get('slabs') as FormArray;
  }

  addSlab(data?: any) {
    const slabForm = this.fb.group({
      min: [data?.min ?? 0, Validators.required],
      max: [data?.max ?? 9999999, Validators.required],
      valueSourceFieldId: [data?.valueSourceFieldId ?? '', Validators.required],
      calcType: [data?.calcType ?? 'Percentage', Validators.required],
      val: [data?.val ?? 0, Validators.required],
      ceiling: [data?.ceiling ?? 0],
      wageTypeFieldId: [data?.wageTypeFieldId ?? '', Validators.required]
    });
    this.slabs.push(slabForm);
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

  toggleStrategyForm(index: number | null = null) {
    this.editingStrategyIndex.set(index);
    this.slabs.clear();

    if (index !== null) {
      const strategy = this.activeContribution()?.rules[index];
      if (strategy) {
        this.strategyForm.patchValue({
          name: strategy.name,
          type: strategy.type,
          effectiveFrom: strategy.effectiveFrom,
          geoGroupId: strategy.geoGroupId
        });
        strategy.slabs.forEach(s => this.addSlab(s));
      }
    } else {
      this.strategyForm.reset({
        type: 'Employer',
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
      const strategy = this.strategyForm.getRawValue();
      const index = this.editingStrategyIndex();
      
      const updatedRules = [...(contribution.rules || [])];
      
      if (index !== null) {
        updatedRules[index] = strategy as any;
      } else {
        updatedRules.push(strategy as any);
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

  async removeStrategy(index: number) {
    this.modal.confirm({
      title: 'Remove strategy',
      message: 'Are you sure you want to remove this rule strategy?',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        const contribution = this.activeContribution()!;
        const updatedRules = [...contribution.rules];
        updatedRules.splice(index, 1);
        
        await this.firestore.updateDocument('contributions', contribution.id!, { rules: updatedRules });
        this.activeContribution.set({ ...contribution, rules: updatedRules });
      }
    });
  }

  requestDelete(id: string) {
    this.modal.confirm({
      title: 'Archive set',
      message: 'Archiving this contribution set removes it from the active payroll processor immediately.',
      confirmLabel: 'Archive rule set',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(id)
    });
  }

  async confirmDelete(id: string) {
    await this.firestore.deleteDocument('contributions', id);
  }

  closeModal() {
    this.modal.close();
  }

  getFlagUrl(code: string | null | undefined) {
    if (!code) return '';
    const country = GLOBAL_COUNTRIES.find(c => c.code === code || c.iso2 === code);
    const iso2 = country?.iso2 || code;
    return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
  }
}
