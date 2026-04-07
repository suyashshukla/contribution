import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { CountryConfig } from '../../models/country-config.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';

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

  countries$ = this.firestore.getCollection<CountryConfig>('countryConfigs');
  globalCountries = GLOBAL_COUNTRIES;

  getFlagUrl(code: string | null | undefined) {
    if (!code) return '';
    const country = this.globalCountries.find(c => c.code === code || c.iso2 === code);
    const iso2 = country?.iso2 || code;
    return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
  }
}
