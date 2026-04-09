import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  ViewChild,
  TemplateRef,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { CountryConfig } from '../../models/country-config.model';
import { GeoGroup } from '../../models/geo-group.model';
import {
  Contribution,
  ContributionType,
  Rule,
  Slab,
  CalculationType,
} from '../../models/contribution.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { take, map, switchMap, of } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { IconPlusComponent } from '../shared/icons';

@Component({
  selector: 'app-rule-config',

  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    NgSelectModule, 
    IconPlusComponent
  ],
  templateUrl: './rule-config.html',
  styleUrl: './rule-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleConfigComponent {
  private formBuilder = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  protected modalService = inject(ModalService);
  private toastService = inject(ToastService);

  @ViewChild('setModal') setModalTemplate!: TemplateRef<any>;
  @ViewChild('manageRulesModal') manageRulesModalTemplate!: TemplateRef<any>;

  ContributionType = ContributionType;
  CalculationType = CalculationType;
  countryCode = input<string | null | undefined>(null);
  isSaving = signal(false);

  // Use toSignal with switchMap to ensure selectedCountry always reflects Firestore state (reactive sync)
  selectedCountry = toSignal(
    toObservable(this.countryCode).pipe(
      switchMap(currentCountryCode => {
        if (!currentCountryCode) return of(null);
        return this.firestoreService.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', currentCountryCode).pipe(
          map(configs => configs.length > 0 ? configs[0] : null)
        );
      })
    )
  );

  showConfirmDelete = signal<string | null>(null);
  activeContribution = signal<Contribution | null>(null);
  showStrategyForm = signal(false);
  editingStrategyIndex = signal<number | null>(null);

  geoGroups$ = toObservable(this.countryCode).pipe(
    switchMap((currentCountryCode) => {
      if (!currentCountryCode) return of([]);
      return this.firestoreService
        .getCollection<GeoGroup>('geoGroups')
        .pipe(
          map((geoGroups) =>
            geoGroups.filter((geoGroup) => geoGroup.countryCode === currentCountryCode),
          ),
        );
    }),
  );

  contributions$ = toObservable(this.countryCode).pipe(
    switchMap((currentCountryCode) => {
      if (!currentCountryCode) return of([]);
      return this.firestoreService.getCollectionByFilter<Contribution>(
        'contributions',
        'countryCode',
        currentCountryCode,
      );
    }),
  );

  setForm = this.formBuilder.group({
    name: ['', Validators.required],
  });

  strategyForm = this.formBuilder.group({
    name: ['', Validators.required],
    type: [ContributionType.Employer, Validators.required],
    effectiveFrom: [new Date().toISOString().split('T')[0], Validators.required],
    geoGroupId: ['', Validators.required],
    slabs: this.formBuilder.array([]),
  });

  get slabs() {
    return this.strategyForm.get('slabs') as FormArray;
  }

  addSlab(initialData?: any) {
    const slabFormGroup = this.formBuilder.group({
      tierLowerLimit: [initialData?.tierLowerLimit ?? 0, Validators.required],
      tierUpperLimit: [initialData?.tierUpperLimit ?? 9999999, Validators.required],
      tierDeterminationFieldId: [initialData?.tierDeterminationFieldId ?? '', Validators.required],
      calculationType: [
        initialData?.calculationType ?? CalculationType.Percentage,
        Validators.required,
      ],
      rateOrAmount: [initialData?.rateOrAmount ?? 0, Validators.required],
      hasContributionCap: [initialData?.hasContributionCap ?? false],
      contributionCap: [initialData?.contributionCap ?? 0],
      calculationBasisFieldId: [initialData?.calculationBasisFieldId ?? '', Validators.required],
    });
    this.slabs.push(slabFormGroup);
  }

  openCreateModal() {
    this.setForm.reset();
    this.modalService.open({
      title: 'Define contribution set',
      size: 'sm',
      template: this.setModalTemplate,
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
      await this.firestoreService.addDocument('contributions', contribution);
      this.modalService.close();
      this.toastService.success('Contribution set created successfully.');
    } catch (error: any) {
      console.error('Error saving contribution set:', error);
      this.toastService.error(error.message || 'Error saving contribution set.');
    } finally {
      this.isSaving.set(false);
    }
  }

  openManageRules(contribution: Contribution) {
    this.activeContribution.set(contribution);
    this.showStrategyForm.set(false);
    this.modalService.open({
      title: `Strategies: ${contribution.name}`,
      side: 'right',
      size: 'xl',
      template: this.manageRulesModalTemplate,
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
          geoGroupId: ruleStrategy.geoGroupId,
        });
        ruleStrategy.slabs.forEach((slab) => this.addSlab(slab));
      }
    } else {
      this.strategyForm.reset({
        type: ContributionType.Employer,
        effectiveFrom: new Date().toISOString().split('T')[0],
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

      await this.firestoreService.updateDocument('contributions', contribution.id!, {
        rules: updatedRules,
      });

      this.activeContribution.set({ ...contribution, rules: updatedRules });
      this.showStrategyForm.set(false);
      this.toastService.success('Rule strategy saved successfully.');
    } catch (error: any) {
      console.error('Error saving rule strategy:', error);
      this.toastService.error(error.message || 'Error saving rule strategy.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async removeStrategy(ruleIndex: number) {
    this.modalService.confirm({
      title: 'Remove strategy',
      message: 'Are you sure you want to remove this rule strategy?',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        const contribution = this.activeContribution()!;
        const updatedRules = [...contribution.rules];
        updatedRules.splice(ruleIndex, 1);

        await this.firestoreService.updateDocument('contributions', contribution.id!, {
          rules: updatedRules,
        });
        this.activeContribution.set({ ...contribution, rules: updatedRules });
      },
    });
  }

  requestDelete(contributionId: string) {
    this.modalService.confirm({
      title: 'Archive set',
      message:
        'Archiving this contribution set removes it from the active payroll processor immediately.',
      confirmLabel: 'Archive rule set',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(contributionId),
    });
  }

  async confirmDelete(contributionId: string) {
    await this.firestoreService.deleteDocument('contributions', contributionId);
  }

  closeModal() {
    this.modalService.close();
  }

  getFlagUrl(countryCode: string | null | undefined) {
    if (!countryCode) return '';
    const country = GLOBAL_COUNTRIES.find(
      (currentCountry) =>
        currentCountry.code === countryCode || currentCountry.iso2 === countryCode,
    );
    const isoCode = country?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }
}
