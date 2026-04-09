import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { 
  Contribution, 
  ContributionType, 
  Rule, 
  Slab, 
  CalculationType 
} from '../models/contribution.model';
import { GeoGroup } from '../models/geo-group.model';
import { CountryConfig } from '../models/country-config.model';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

export interface ImportResult {
  success: boolean;
  message: string;
  statistics?: {
    fieldsCreated: number;
    groupsCreated: number;
    setsCreated: number;
    rulesUpdated: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ImportService {
  private firestoreService = inject(FirestoreService);

  /**
   * Imports rules from an Excel file for multiple countries at once.
   */
  async importRulesFromExcel(file: File): Promise<ImportResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (rawRows.length === 0) {
        return { success: false, message: 'The selected Excel file is empty.' };
      }

      // Normalize row keys
      const normalizedRows = rawRows.map(row => {
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          normalizedRow[key.trim()] = row[key];
        });
        return normalizedRow;
      });

      // Group rows by Country Code
      const countryGroups = new Map<string, any[]>();
      normalizedRows.forEach(row => {
        const countryCode = row['Country Code']?.toString().toUpperCase();
        if (countryCode) {
          if (!countryGroups.has(countryCode)) countryGroups.set(countryCode, []);
          countryGroups.get(countryCode)!.push(row);
        }
      });

      if (countryGroups.size === 0) {
        throw new Error('No valid "Country Code" column found in Excel.');
      }

      const totalStatistics = {
        fieldsCreated: 0,
        groupsCreated: 0,
        setsCreated: 0,
        rulesUpdated: 0
      };

      for (const [countryCode, rows] of countryGroups.entries()) {
        const countryStats = await this.processCountryData(rows, countryCode);
        totalStatistics.fieldsCreated += countryStats.fieldsCreated;
        totalStatistics.groupsCreated += countryStats.groupsCreated;
        totalStatistics.setsCreated += countryStats.setsCreated;
        totalStatistics.rulesUpdated += countryStats.rulesUpdated;
      }

      return { 
        success: true, 
        message: `Import complete: Processed ${countryGroups.size} countries with ${totalStatistics.rulesUpdated} rules.`,
        statistics: totalStatistics
      };
    } catch (error: any) {
      console.error('Import Service Error:', error);
      return { success: false, message: error.message || 'Failed to process bulk import.' };
    }
  }

  private async processCountryData(rows: any[], countryCode: string) {
    const statistics = {
      fieldsCreated: 0,
      groupsCreated: 0,
      setsCreated: 0,
      rulesUpdated: 0
    };

    // 1. Get Country Config
    const countryConfigs = await firstValueFrom(this.firestoreService.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', countryCode));
    if (countryConfigs.length === 0) throw new Error(`Jurisdiction ${countryCode} must be initialized in the UI first.`);
    
    let currentConfig = countryConfigs[0];
    const existingGroups = await firstValueFrom(this.firestoreService.getCollectionByFilter<GeoGroup>('geoGroups', 'countryCode', countryCode));
    const existingSets = await firstValueFrom(this.firestoreService.getCollectionByFilter<Contribution>('contributions', 'countryCode', countryCode));

    // 2. Sync Fields
    const fieldResult = await this.ensureFieldsExist(rows, currentConfig);
    currentConfig = fieldResult.config;
    statistics.fieldsCreated = fieldResult.createdCount;

    // 3. Sync Geo Groups
    const groupResult = await this.ensureGeoGroupsExist(rows, countryCode, existingGroups);
    const updatedGeoGroups = groupResult.groups;
    statistics.groupsCreated = groupResult.createdCount;

    // 4. Group by Contribution Set
    const setGroups = new Map<string, any[]>();
    rows.forEach(row => {
      const setName = row['Contribution Set'] || 'Default Set';
      if (!setGroups.has(setName)) setGroups.set(setName, []);
      setGroups.get(setName)!.push(row);
    });

    // 5. Process Sets
    for (const [setName, setRows] of setGroups.entries()) {
      let contribution = existingSets.find(s => s.name.toLowerCase() === setName.toLowerCase());
      const rules: Rule[] = contribution ? [...contribution.rules] : [];
      if (!contribution) statistics.setsCreated++;

      // Group rows by Rule metadata
      const ruleGroups = new Map<string, any[]>();
      setRows.forEach(row => {
        const key = `${row['Rule Name']}_${row['Type']}_${row['Effective From']}_${row['Geographic Group']}`.toLowerCase();
        if (!ruleGroups.has(key)) ruleGroups.set(key, []);
        ruleGroups.get(key)!.push(row);
      });

      for (const ruleRows of ruleGroups.values()) {
        const firstRow = ruleRows[0];
        const geoGroupName = firstRow['Geographic Group'] || 'All Regions';
        const geoGroupId = updatedGeoGroups.find(g => g.name.toLowerCase() === geoGroupName.toLowerCase())?.id || '';

        const slabs: Slab[] = ruleRows.map(row => {
          const determinationField = currentConfig.fields.find(f => 
            f.name.toLowerCase() === (row['Tier Determination Field'] || row['Value Source'])?.toString().toLowerCase()
          );
          const basisField = currentConfig.fields.find(f => 
            f.name.toLowerCase() === (row['Calculation Basis Field'] || row['Wage Basis'])?.toString().toLowerCase()
          );

          return {
            tierLowerLimit: Number(row['Tier Lower Limit'] || row['Min Threshold'] || 0),
            tierUpperLimit: Number(row['Tier Upper Limit'] || row['Max Threshold'] || 999999999),
            tierDeterminationFieldId: determinationField?.id || '',
            calculationType: (row['Calculation Type'] === 'Fixed' ? CalculationType.Fixed : CalculationType.Percentage),
            rateOrAmount: Number(row['Rate or Amount'] || row['Value'] || 0),
            hasContributionCap: row['Has Contribution Cap']?.toString().toLowerCase() === 'yes',
            contributionCap: Number(row['Contribution Cap'] || row['Max Amount'] || 0),
            calculationBasisFieldId: basisField?.id || ''
          };
        });

        const newRule: Rule = {
          name: firstRow['Rule Name'],
          type: firstRow['Type'] === 'Employee' ? ContributionType.Employee : ContributionType.Employer,
          effectiveFrom: this.formatExcelDate(firstRow['Effective From']),
          geoGroupId,
          slabs
        };

        const existingIndex = rules.findIndex(r => 
          r.name.toLowerCase() === newRule.name.toLowerCase() && 
          r.type === newRule.type && 
          r.effectiveFrom === newRule.effectiveFrom && 
          r.geoGroupId === newRule.geoGroupId
        );

        if (existingIndex > -1) rules[existingIndex] = newRule;
        else rules.push(newRule);
        statistics.rulesUpdated++;
      }

      if (contribution) await this.firestoreService.updateDocument('contributions', contribution.id!, { rules });
      else await this.firestoreService.addDocument('contributions', { name: setName, countryCode, rules });
    }

    return statistics;
  }

  async generateGlobalTemplate(): Promise<void> {
    try {
      const allCountries = await firstValueFrom(this.firestoreService.getCollection<CountryConfig>('countryConfigs'));
      const allGeoGroups = await firstValueFrom(this.firestoreService.getCollection<GeoGroup>('geoGroups'));
      const allContributions = await firstValueFrom(this.firestoreService.getCollection<Contribution>('contributions'));

      const rows: any[] = [];

      allCountries.forEach(config => {
        const sets = allContributions.filter(c => c.countryCode === config.countryCode);
        const groups = allGeoGroups.filter(g => g.countryCode === config.countryCode);

        sets.forEach(set => {
          set.rules.forEach(rule => {
            const groupName = groups.find(g => g.id === rule.geoGroupId)?.name || 'All Regions';
            rule.slabs.forEach(slab => {
              rows.push({
                'Country Code': config.countryCode,
                'Contribution Set': set.name,
                'Rule Name': rule.name,
                'Type': rule.type,
                'Effective From': rule.effectiveFrom,
                'Geographic Group': groupName,
                'Tier Lower Limit': slab.tierLowerLimit,
                'Tier Upper Limit': slab.tierUpperLimit,
                'Tier Determination Field': config.fields.find(f => f.id === slab.tierDeterminationFieldId)?.name || '',
                'Calculation Type': slab.calculationType,
                'Rate or Amount': slab.rateOrAmount,
                'Has Contribution Cap': slab.hasContributionCap ? 'Yes' : 'No',
                'Contribution Cap': slab.contributionCap,
                'Calculation Basis Field': config.fields.find(f => f.id === slab.calculationBasisFieldId)?.name || ''
              });
            });
          });
        });

        if (sets.length === 0) {
          rows.push({
            'Country Code': config.countryCode,
            'Contribution Set': 'Sample Set',
            'Rule Name': 'Standard Rate',
            'Type': 'Employer',
            'Effective From': new Date().toISOString().split('T')[0],
            'Geographic Group': 'All Regions',
            'Tier Lower Limit': 0,
            'Tier Upper Limit': 999999,
            'Tier Determination Field': config.fields[0]?.name || 'Gross Pay',
            'Calculation Type': CalculationType.Percentage,
            'Rate or Amount': 5,
            'Has Contribution Cap': 'No',
            'Contribution Cap': 0,
            'Calculation Basis Field': config.fields[0]?.name || 'Basic Salary'
          });
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Global Rules');
      XLSX.writeFile(workbook, `Global_Payroll_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Template Error:', error);
      throw new Error('Failed to generate global template.');
    }
  }

  private async ensureFieldsExist(rows: any[], config: CountryConfig): Promise<{ config: CountryConfig, createdCount: number }> {
    const names = new Set<string>();
    rows.forEach(row => {
      const d = row['Tier Determination Field'] || row['Value Source'];
      const b = row['Calculation Basis Field'] || row['Wage Basis'];
      if (d) names.add(d.toString().trim());
      if (b) names.add(b.toString().trim());
    });

    let changed = false;
    let count = 0;
    const fields = [...config.fields];

    names.forEach(name => {
      if (name && !fields.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        fields.push({ id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), name, type: 'numeric' });
        changed = true;
        count++;
      }
    });

    if (changed) {
      await this.firestoreService.updateDocument('countryConfigs', config.id!, { fields });
      return { config: { ...config, fields }, createdCount: count };
    }
    return { config, createdCount: 0 };
  }

  private async ensureGeoGroupsExist(rows: any[], countryCode: string, existing: GeoGroup[]): Promise<{ groups: GeoGroup[], createdCount: number }> {
    const names = new Set<string>();
    rows.forEach(row => {
      const n = row['Geographic Group'];
      if (n) names.add(n.toString().trim());
    });

    const groups = [...existing];
    let count = 0;

    for (const name of names) {
      if (name && !groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
        const group: GeoGroup = { countryCode, name, type: 'country', selectionMode: 'include', entities: [] };
        const ref = await this.firestoreService.addDocument('geoGroups', group);
        groups.push({ ...group, id: ref.id });
        count++;
      }
    }
    return { groups, createdCount: count };
  }

  private formatExcelDate(excelDate: any): string {
    if (!excelDate) return new Date().toISOString().split('T')[0];
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    try {
      const date = new Date(excelDate);
      if (isNaN(date.getTime())) return excelDate.toString();
      return date.toISOString().split('T')[0];
    } catch {
      return excelDate.toString();
    }
  }
}
