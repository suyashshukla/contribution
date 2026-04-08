import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { CountryConfig } from '../../models/country-config.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { map } from 'rxjs';

@Component({
  selector: 'app-country-setup',
  imports: [CommonModule, RouterModule, NgSelectModule],
  templateUrl: './country-setup.html',
  styleUrl: './country-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountrySetupComponent {
  private firestore = inject(FirestoreService);
  private modal = inject(ModalService);
  private router = inject(Router);

  countries$ = this.firestore.getCollection<CountryConfig>('countryConfigs');
  globalCountries = GLOBAL_COUNTRIES;

  availableCountries$ = this.countries$.pipe(
    map(existingConfigs => {
      const existingCodes = new Set(existingConfigs.map(config => config.countryCode));
      return this.globalCountries.filter(country => !existingCodes.has(country.code));
    })
  );

  getFlagUrl(countryCode: string | null | undefined) {
    if (!countryCode) return '';
    const countryItem = this.globalCountries.find(country => country.code === countryCode || country.iso2 === countryCode);
    const isoCode = countryItem?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }

  onCountrySelect(countryItem: any) {
    if (countryItem) {
      this.router.navigate(['/manage-country', 'new'], { 
        queryParams: { 
          name: countryItem.name, 
          code: countryItem.code 
        } 
      });
    }
  }
}
