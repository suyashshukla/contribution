import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { 
  Contribution, 
  ContributionType, 
  Rule, 
  Slab, 
  CalculationType 
} from '../models/contribution.model';
import { GeoGroup, GeoType } from '../models/geo-group.model';
import { CountryConfig, CountryField } from '../models/country-config.model';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

export interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImportService {
  private firestore = inject(FirestoreService);

  async importRulesFromExcel(file: File, countryCode: string): Promise<ImportResult> {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        return { success: false, message: 'The selected Excel file is empty.' };
      }

      await this.processImportedData(jsonData, countryCode);
      return { success: true, message: 'Rules imported and synchronized successfully.' };
    } catch (error: any) {
      console.error('Import Service Error:', error);
      return { success: false, message: error.message || 'Failed to process import.' };
    }
  }

  private async processImportedData(rows: any[], countryCode: string) {
    // 1. Get current state
    const countryConfigs = await firstValueFrom(this.firestore.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', countryCode));
    if (countryConfigs.length === 0) throw new Error(`No country configuration found for ${countryCode}`);
    
    let countryConfig = countryConfigs[0];
    const geoGroups = await firstValueFrom(this.firestore.getCollectionByFilter<GeoGroup>('geoGroups', 'countryCode', countryCode));
    const existingContributions = await firstValueFrom(this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', countryCode));

    // 2. Ensure all fields exist in CountryConfig
    countryConfig = await this.ensureFieldsExist(rows, countryConfig);

    // 3. Ensure all geographic groups exist
    const updatedGeoGroups = await this.ensureGeoGroupsExist(rows, countryCode, geoGroups);

    // 4. Group rows by Contribution Set
    const contributionGroups = new Map<string, any[]>();
    rows.forEach(row => {
      const setName = row['Contribution Set'] || row['Set Name'] || 'Default Set';
      if (!contributionGroups.has(setName)) contributionGroups.set(setName, []);
      contributionGroups.get(setName)!.push(row);
    });

    // 5. Process each set
    for (const [setName, setRows] of contributionGroups.entries()) {
      let contribution = existingContributions.find(c => c.name === setName);
      const rules: Rule[] = contribution ? [...contribution.rules] : [];

      // Group rows by Rule uniqueness
      const ruleGroups = new Map<string, any[]>();
      setRows.forEach(row => {
        const ruleKey = `${row['Rule Name']}_${row['Type']}_${row['Effective From']}_${row['Geographic Group']}`;
        if (!ruleGroups.has(ruleKey)) ruleGroups.set(ruleKey, []);
        ruleGroups.get(ruleKey)!.push(row);
      });

      for (const [_, ruleRows] of ruleGroups.entries()) {
        const firstRow = ruleRows[0];
        const ruleName = firstRow['Rule Name'];
        const type = (firstRow['Type'] === 'Employee' ? ContributionType.Employee : ContributionType.Employer);
        const effectiveFrom = this.formatExcelDate(firstRow['Effective From']);
        
        const geoGroupName = firstRow['Geographic Group'] || 'All Regions';
        const geoGroup = updatedGeoGroups.find(g => g.name === geoGroupName);
        const geoGroupId = geoGroup?.id || '';

        const slabs: Slab[] = ruleRows.map(row => ({
          tierLowerLimit: Number(row['Tier Lower Limit'] || row['Min Threshold'] || 0),
          tierUpperLimit: Number(row['Tier Upper Limit'] || row['Max Threshold'] || 999999999),
          tierDeterminationFieldId: countryConfig.fields.find(f => f.name === (row['Tier Determination Field'] || row['Value Source']))?.id || '',
          calculationType: (row['Calculation Type'] === 'Fixed' ? CalculationType.Fixed : CalculationType.Percentage),
          rateOrAmount: Number(row['Rate or Amount'] || row['Value'] || 0),
          contributionCap: Number(row['Contribution Cap'] || row['Max Amount'] || 0),
          calculationBasisFieldId: countryConfig.fields.find(f => f.name === (row['Calculation Basis Field'] || row['Wage Basis']))?.id || ''
        }));

        // Upsert Rule
        const existingRuleIndex = rules.findIndex(r => 
          r.name === ruleName && 
          r.type === type && 
          r.effectiveFrom === effectiveFrom && 
          r.geoGroupId === geoGroupId
        );

        const newRule: Rule = { name: ruleName, type, effectiveFrom, geoGroupId, slabs };

        if (existingRuleIndex > -1) {
          rules[existingRuleIndex] = newRule;
        } else {
          rules.push(newRule);
        }
      }

      // Save Contribution Set
      if (contribution) {
        await this.firestore.updateDocument('contributions', contribution.id!, { rules });
      } else {
        await this.firestore.addDocument('contributions', {
          name: setName,
          countryCode,
          rules
        });
      }
    }
  }

  private async ensureFieldsExist(rows: any[], config: CountryConfig): Promise<CountryConfig> {
    const fieldNamesInExcel = new Set<string>();
    rows.forEach(row => {
      const determinationField = row['Tier Determination Field'] || row['Value Source'];
      const basisField = row['Calculation Basis Field'] || row['Wage Basis'];
      if (determinationField) fieldNamesInExcel.add(determinationField);
      if (basisField) fieldNamesInExcel.add(basisField);
    });

    let configChanged = false;
    const currentFields = [...config.fields];

    fieldNamesInExcel.forEach(name => {
      if (!currentFields.some(f => f.name === name)) {
        currentFields.push({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name: name,
          type: 'numeric'
        });
        configChanged = true;
      }
    });

    if (configChanged) {
      await this.firestore.updateDocument('countryConfigs', config.id!, { fields: currentFields });
      return { ...config, fields: currentFields };
    }
    return config;
  }

  private async ensureGeoGroupsExist(rows: any[], countryCode: string, existingGroups: GeoGroup[]): Promise<GeoGroup[]> {
    const geoNamesInExcel = new Set<string>();
    rows.forEach(row => {
      const name = row['Geographic Group'];
      if (name) geoNamesInExcel.add(name);
    });

    const activeGroups = [...existingGroups];

    for (const name of geoNamesInExcel) {
      if (!activeGroups.some(g => g.name === name)) {
        const newGroup: GeoGroup = {
          countryCode,
          name,
          type: 'country', // Default to country level for new groups
          selectionMode: 'include',
          entities: [] // This might need refinement based on business logic
        };
        const docRef = await this.firestore.addDocument('geoGroups', newGroup);
        activeGroups.push({ ...newGroup, id: docRef.id });
      }
    }

    return activeGroups;
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
