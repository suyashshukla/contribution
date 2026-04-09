import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { ImportService } from '../../services/import.service';
import { CountryConfig } from '../../models/country-config.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { map } from 'rxjs';
import { 
  IconDownloadComponent, 
  IconUploadComponent 
} from '../shared/icons';

@Component({
  selector: 'app-country-setup',
  imports: [
    CommonModule, 
    RouterModule, 
    NgSelectModule,
    IconDownloadComponent,
    IconUploadComponent
  ],
  templateUrl: './country-setup.html',
  styleUrl: './country-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountrySetupComponent {
  private firestore = inject(FirestoreService);
  private modal = inject(ModalService);
  private router = inject(Router);
  private importService = inject(ImportService);
  private toastService = inject(ToastService);

  countries$ = this.firestore.getCollection<CountryConfig>('countryConfigs');
  globalCountries = GLOBAL_COUNTRIES;
  isImporting = signal(false);

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

  async onBulkFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.isImporting.set(true);
      const result = await this.importService.importRulesFromExcel(file);
      
      if (result.success) {
        this.toastService.success(result.message);
      } else {
        this.toastService.error(result.message);
      }
    } catch (error: any) {
      console.error('Bulk Import UI Error:', error);
      this.toastService.error('An unexpected error occurred during bulk import.');
    } finally {
      this.isImporting.set(false);
      event.target.value = ''; // Reset file input
    }
  }

  async downloadGlobalTemplate() {
    try {
      await this.importService.generateGlobalTemplate();
      this.toastService.success('Global template downloaded successfully.');
    } catch (error: any) {
      console.error('Global Template Download Error:', error);
      this.toastService.error('Failed to generate global template.');
    }
  }
}
