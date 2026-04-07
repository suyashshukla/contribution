import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { CalculationService, CalculationResult } from '../../services/calculation.service';
import { CountryConfig } from '../../models/country-config.model';
import { Contribution } from '../../models/contribution.model';
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
  private fb = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  private calcService = inject(CalculationService);

  countries$ = this.firestore.getCollection<CountryConfig>('countryConfigs');
  globalCountries = GLOBAL_COUNTRIES;
  
  selectedCountry = signal<CountryConfig | null>(null);
  results = signal<CalculationResult[]>([]);
  dynamicForm: FormGroup = this.fb.group({});

  employerTotal = computed(() => 
    this.results().filter(r => r.type === 'Employer').reduce((acc, curr) => acc + curr.amount, 0)
  );

  employeeTotal = computed(() => 
    this.results().filter(r => r.type === 'Employee').reduce((acc, curr) => acc + curr.amount, 0)
  );

  getFlagUrl(code: string | undefined) {
    if (!code) return '';
    const country = this.globalCountries.find(c => c.code === code || c.iso2 === code);
    const iso2 = country?.iso2 || code;
    return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
  }

  onCountryChange(country: CountryConfig | null) {
    if (!country) {
      this.selectedCountry.set(null);
      this.dynamicForm = this.fb.group({});
      this.results.set([]);
      return;
    }

    this.selectedCountry.set(country);
    this.buildForm(country);
    this.results.set([]);
  }

  private buildForm(config: CountryConfig) {
    const group: any = {};
    config.fields.forEach(field => {
      group[field.id] = [0, [Validators.required, Validators.min(0)]];
    });
    this.dynamicForm = this.fb.group(group);
  }

  async calculate() {
    if (this.dynamicForm.invalid || !this.selectedCountry()) return;

    const countryCode = this.selectedCountry()!.countryCode;
    const inputs = this.dynamicForm.getRawValue();

    combineLatest([
      this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', countryCode),
      this.firestore.getCollectionByFilter<GeoGroup>('geoGroups', 'countryCode', countryCode)
    ]).pipe(take(1)).subscribe(([contributions, geoGroups]) => {
      const calcResults = this.calcService.calculate(contributions, inputs);
      this.results.set(calcResults);
    });
  }
}
