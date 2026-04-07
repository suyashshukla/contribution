import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { CalculationService, CalculationResult } from '../../services/calculation.service';
import { CountryConfig } from '../../models/country-config.model';
import { Contribution, ContributionType } from '../../models/contribution.model';
import { GeoGroup } from '../../models/geo-group.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { take, combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-calculation-engine',

  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './calculation-engine.html',
  styleUrl: './calculation-engine.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculationEngineComponent {
  private formBuilder = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  private calculationService = inject(CalculationService);

  ContributionType = ContributionType;
  countries$ = this.firestore.getCollection<CountryConfig>('countryConfigs');
  globalCountries = GLOBAL_COUNTRIES;
  
  selectedCountry = signal<CountryConfig | null>(null);
  results = signal<CalculationResult[]>([]);
  runDate = signal<string>(new Date().toISOString().split('T')[0]);
  dynamicForm: FormGroup = this.formBuilder.group({});

  employerTotal = computed(() => 
    this.results().filter(result => result.type === ContributionType.Employer).reduce((accumulator, currentValue) => accumulator + currentValue.amount, 0)
  );

  employeeTotal = computed(() => 
    this.results().filter(result => result.type === ContributionType.Employee).reduce((accumulator, currentValue) => accumulator + currentValue.amount, 0)
  );

  getFlagUrl(countryCode: string | undefined) {
    if (!countryCode) return '';
    const country = this.globalCountries.find(countryItem => countryItem.code === countryCode || countryItem.iso2 === countryCode);
    const isoCode = country?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }

  onRunDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.runDate.set(target.value);
  }

  onCountryChange(country: CountryConfig | null) {
    if (!country) {
      this.selectedCountry.set(null);
      this.dynamicForm = this.formBuilder.group({});
      this.results.set([]);
      return;
    }

    this.selectedCountry.set(country);
    this.buildForm(country);
    this.results.set([]);
  }

  private buildForm(countryConfig: CountryConfig) {
    const formGroup: any = {};
    countryConfig.fields.forEach(field => {
      switch (field.type) {
        case 'numeric':
          formGroup[field.id] = [0, [Validators.required, Validators.min(0)]];
          break;
        case 'date':
          formGroup[field.id] = ['', [Validators.required]];
          break;
        case 'string':
          formGroup[field.id] = ['', [Validators.required]];
          break;
        default:
          formGroup[field.id] = ['', [Validators.required]];
      }
    });
    this.dynamicForm = this.formBuilder.group(formGroup);
  }

  async calculate() {
    if (this.dynamicForm.invalid || !this.selectedCountry()) return;

    const countryCode = this.selectedCountry()!.countryCode;
    const inputs = this.dynamicForm.getRawValue();
    const runDate = this.runDate();

    combineLatest([
      this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', countryCode),
      this.firestore.getCollectionByFilter<GeoGroup>('geoGroups', 'countryCode', countryCode)
    ]).pipe(take(1)).subscribe(([contributions, geoGroups]) => {
      const calculationResults = this.calculationService.calculate(contributions, inputs, runDate);
      this.results.set(calculationResults);
    });
  }
}
