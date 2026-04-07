import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  effect,
  signal,
  ViewChild,
  TemplateRef,
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
import { take, map, switchMap, of, firstValueFrom } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import * as XLSX from 'xlsx';

import { IconPlusComponent, IconDownloadComponent, IconUploadComponent } from '../shared/icons';

@Component({
  selector: 'app-rule-config',

  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    NgSelectModule, 
    IconPlusComponent, 
    IconDownloadComponent, 
    IconUploadComponent
  ],
  templateUrl: './rule-config.html',
  styleUrl: './rule-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleConfigComponent {
  private formBuilder = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  protected modal = inject(ModalService);
  private toast = inject(ToastService);

  @ViewChild('setModal') setModalTemplate!: TemplateRef<any>;
  @ViewChild('manageRulesModal') manageRulesModalTemplate!: TemplateRef<any>;

  ContributionType = ContributionType;
  CalculationType = CalculationType;
  countryCode = input<string | null | undefined>(null);
  selectedCountry = signal<CountryConfig | null>(null);
  isSaving = signal(false);
  isImporting = signal(false);

  showConfirmDelete = signal<string | null>(null);
  activeContribution = signal<Contribution | null>(null);
  showStrategyForm = signal(false);
  editingStrategyIndex = signal<number | null>(null);

  geoGroups$ = toObservable(this.countryCode).pipe(
    switchMap((currentCountryCode) => {
      if (!currentCountryCode) return of([]);
      return this.firestore
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
      return this.firestore.getCollectionByFilter<Contribution>(
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

  constructor() {
    effect(() => {
      const currentCountryCode = this.countryCode();
      if (currentCountryCode) {
        this.loadCountrySchema(currentCountryCode);
      }
    });
  }

  loadCountrySchema(currentCountryCode: string) {
    this.firestore
      .getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', currentCountryCode)
      .pipe(take(1))
      .subscribe((countryConfigs) => {
        if (countryConfigs.length > 0) {
          this.selectedCountry.set(countryConfigs[0]);
        }
      });
  }

  get slabs() {
    return this.strategyForm.get('slabs') as FormArray;
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.isImporting.set(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        this.toast.error('The selected Excel file is empty.');
        return;
      }

      await this.processImportedData(jsonData);
      this.toast.success('Rules imported and synchronized successfully.');
    } catch (error: any) {
      console.error('Excel Import Error:', error);
      this.toast.error('Failed to import Excel file. Ensure it follows the correct schema.');
    } finally {
      this.isImporting.set(false);
      event.target.value = ''; // Reset file input
    }
  }

  async downloadTemplate() {
    try {
      const contributions = await firstValueFrom(this.contributions$);
      const geoGroups = await firstValueFrom(this.geoGroups$);
      const countryConfig = this.selectedCountry();

      if (!countryConfig) {
        this.toast.error('Country configuration not loaded.');
        return;
      }

      const rows: any[] = [];

      contributions.forEach((contribution) => {
        contribution.rules.forEach((rule) => {
          const geoGroupName =
            geoGroups.find((geoGroup) => geoGroup.id === rule.geoGroupId)?.name || '';

          rule.slabs.forEach((slab) => {
            rows.push({
              'Contribution Set': contribution.name,
              'Rule Name': rule.name,
              Type: rule.type,
              'Effective From': rule.effectiveFrom,
              'Geographic Group': geoGroupName,
              'Tier Lower Limit': slab.tierLowerLimit,
              'Tier Upper Limit': slab.tierUpperLimit,
              'Tier Determination Field':
                countryConfig.fields.find((field) => field.id === slab.tierDeterminationFieldId)
                  ?.name || '',
              'Calculation Type': slab.calculationType,
              'Rate or Amount': slab.rateOrAmount,
              'Contribution Cap': slab.contributionCap,
              'Calculation Basis Field':
                countryConfig.fields.find((field) => field.id === slab.calculationBasisFieldId)
                  ?.name || '',
            });
          });
        });
      });

      // If no data, add a sample row
      if (rows.length === 0) {
        rows.push({
          'Contribution Set': 'Sample Set',
          'Rule Name': 'Standard Rate',
          Type: 'Employer',
          'Effective From': new Date().toISOString().split('T')[0],
          'Geographic Group': geoGroups[0]?.name || 'All Regions',
          'Tier Lower Limit': 0,
          'Tier Upper Limit': 999999,
          'Tier Determination Field': countryConfig.fields[0]?.name || '',
          'Calculation Type': CalculationType.Percentage,
          'Rate or Amount': 5,
          'Contribution Cap': 0,
          'Calculation Basis Field': countryConfig.fields[0]?.name || '',
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contribution Rules');

      const fileName = `Contribution_Template_${countryConfig.countryCode}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.toast.success('Template downloaded successfully.');
    } catch (error: any) {
      console.error('Download Template Error:', error);
      this.toast.error('Failed to generate Excel template.');
    }
  }

  private async processImportedData(rows: any[]) {
    const countryCode = this.countryCode()!;
    const geoGroups = await firstValueFrom(this.geoGroups$);
    const countryConfig = this.selectedCountry()!;
    const existingContributions = await firstValueFrom(this.contributions$);

    // Group rows by Contribution Set Name and then by Rule Name + Type + Date + Geo
    const contributionGroups = new Map<string, any[]>();
    rows.forEach((row) => {
      const setName = row['Contribution Set'] || row['Set Name'] || 'Default Set';
      if (!contributionGroups.has(setName)) contributionGroups.set(setName, []);
      contributionGroups.get(setName)!.push(row);
    });

    for (const [setName, setRows] of contributionGroups.entries()) {
      let contribution = existingContributions.find(
        (contributionItem) => contributionItem.name === setName,
      );
      const updatedRules: Rule[] = contribution ? [...contribution.rules] : [];

      // Group rows within this set by Rule uniqueness
      const ruleGroups = new Map<string, any[]>();
      setRows.forEach((row) => {
        const ruleKey = `${row['Rule Name']}_${row['Type']}_${row['Effective From']}_${row['Geographic Group']}`;
        if (!ruleGroups.has(ruleKey)) ruleGroups.set(ruleKey, []);
        ruleGroups.get(ruleKey)!.push(row);
      });

      for (const [_, ruleRows] of ruleGroups.entries()) {
        const firstRow = ruleRows[0];
        const ruleName = firstRow['Rule Name'];
        const type =
          firstRow['Type'] === 'Employee' ? ContributionType.Employee : ContributionType.Employer;
        const effectiveFrom = this.formatExcelDate(firstRow['Effective From']);

        const geoGroupName = firstRow['Geographic Group'];
        const geoGroupId = geoGroups.find((geoGroup) => geoGroup.name === geoGroupName)?.id || '';

        const slabs: Slab[] = ruleRows.map((row) => ({
          tierLowerLimit: Number(row['Tier Lower Limit'] || row['Min Threshold'] || 0),
          tierUpperLimit: Number(row['Tier Upper Limit'] || row['Max Threshold'] || 999999999),
          tierDeterminationFieldId:
            countryConfig.fields.find(
              (field) => field.name === (row['Tier Determination Field'] || row['Value Source']),
            )?.id || '',
          calculationType:
            row['Calculation Type'] === CalculationType.Fixed
              ? CalculationType.Fixed
              : CalculationType.Percentage,
          rateOrAmount: Number(row['Rate or Amount'] || row['Value'] || 0),
          contributionCap: Number(
            row['Contribution Cap'] || row['Max Amount'] || row['Ceiling'] || 0,
          ),
          calculationBasisFieldId:
            countryConfig.fields.find(
              (field) => field.name === (row['Calculation Basis Field'] || row['Wage Basis']),
            )?.id || '',
        }));

        // Smart Logic: Find if rule already exists in this contribution
        const existingRuleIndex = updatedRules.findIndex(
          (rule) =>
            rule.name === ruleName &&
            rule.type === type &&
            rule.effectiveFrom === effectiveFrom &&
            rule.geoGroupId === geoGroupId,
        );

        const newRule: Rule = { name: ruleName, type, effectiveFrom, geoGroupId, slabs };

        if (existingRuleIndex !== null && existingRuleIndex > -1) {
          updatedRules[existingRuleIndex] = newRule;
        } else {
          updatedRules.push(newRule);
        }
      }

      if (contribution) {
        await this.firestore.updateDocument('contributions', contribution.id!, {
          rules: updatedRules,
        });
      } else {
        await this.firestore.addDocument('contributions', {
          name: setName,
          countryCode,
          rules: updatedRules,
        });
      }
    }
  }

  private formatExcelDate(excelDate: any): string {
    if (!excelDate) return new Date().toISOString().split('T')[0];

    // Handle Excel serial date if necessary
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Handle string date
    try {
      const date = new Date(excelDate);
      if (isNaN(date.getTime())) throw new Error();
      return date.toISOString().split('T')[0];
    } catch {
      return excelDate.toString(); // Fallback to raw string if it looks like YYYY-MM-DD
    }
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
      contributionCap: [initialData?.contributionCap ?? 0],
      calculationBasisFieldId: [initialData?.calculationBasisFieldId ?? '', Validators.required],
    });
    this.slabs.push(slabFormGroup);
  }

  openCreateModal() {
    this.setForm.reset();
    this.modal.open({
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
        rules: [],
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

      await this.firestore.updateDocument('contributions', contribution.id!, {
        rules: updatedRules,
      });

      this.activeContribution.set({ ...contribution, rules: updatedRules });
      this.showStrategyForm.set(false);
      this.toast.success('Rule strategy saved successfully.');
    } catch (error: any) {
      console.error('Error saving rule strategy:', error);
      this.toast.error(error.message || 'Error saving rule strategy.');
    } finally {
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

        await this.firestore.updateDocument('contributions', contribution.id!, {
          rules: updatedRules,
        });
        this.activeContribution.set({ ...contribution, rules: updatedRules });
      },
    });
  }

  requestDelete(contributionId: string) {
    this.modal.confirm({
      title: 'Archive set',
      message:
        'Archiving this contribution set removes it from the active payroll processor immediately.',
      confirmLabel: 'Archive rule set',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(contributionId),
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
    const country = GLOBAL_COUNTRIES.find(
      (currentCountry) =>
        currentCountry.code === countryCode || currentCountry.iso2 === countryCode,
    );
    const isoCode = country?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }
}
