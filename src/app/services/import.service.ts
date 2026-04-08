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
  stats?: {
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
  private firestore = inject(FirestoreService);

  async importRulesFromExcel(file: File, countryCode: string): Promise<ImportResult> {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (rawRows.length === 0) {
        return { success: false, message: 'The selected Excel file is empty.' };
      }

      // Normalize row keys (remove whitespace, handle case)
      const rows = rawRows.map(row => {
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          normalizedRow[key.trim()] = row[key];
        });
        return normalizedRow;
      });

      const stats = await this.processImportedData(rows, countryCode);
      return { 
        success: true, 
        message: `Import complete: Created ${stats.fieldsCreated} fields, ${stats.groupsCreated} groups, and processed ${stats.setsCreated} sets.`,
        stats
      };
    } catch (error: any) {
      console.error('Import Service Error:', error);
      return { success: false, message: error.message || 'Failed to process import.' };
    }
  }

  private async processImportedData(rows: any[], countryCode: string) {
    const stats = {
      fieldsCreated: 0,
      groupsCreated: 0,
      setsCreated: 0,
      rulesUpdated: 0
    };

    // 1. Get current state
    const countryConfigs = await firstValueFrom(this.firestore.getCollectionByFilter<CountryConfig>('countryConfigs', 'countryCode', countryCode));
    if (countryConfigs.length === 0) throw new Error(`No country configuration found for jurisdiction: ${countryCode}`);
    
    let countryConfig = countryConfigs[0];
    const geoGroups = await firstValueFrom(this.firestore.getCollectionByFilter<GeoGroup>('geoGroups', 'countryCode', countryCode));
    const existingContributions = await firstValueFrom(this.firestore.getCollectionByFilter<Contribution>('contributions', 'countryCode', countryCode));

    // 2. Ensure all fields exist in CountryConfig
    const fieldResult = await this.ensureFieldsExist(rows, countryConfig);
    countryConfig = fieldResult.config;
    stats.fieldsCreated = fieldResult.createdCount;

    // 3. Ensure all geographic groups exist
    const groupResult = await this.ensureGeoGroupsExist(rows, countryCode, geoGroups);
    const updatedGeoGroups = groupResult.groups;
    stats.groupsCreated = groupResult.createdCount;

    // 4. Group rows by Contribution Set
    const contributionGroups = new Map<string, any[]>();
    rows.forEach(row => {
      const setName = row['Contribution Set'] || row['Set Name'] || 'Default Set';
      if (!contributionGroups.has(setName)) contributionGroups.set(setName, []);
      contributionGroups.get(setName)!.push(row);
    });

    // 5. Process each set
    for (const [setName, setRows] of contributionGroups.entries()) {
      let contribution = existingContributions.find(c => c.name.toLowerCase() === setName.toLowerCase());
      const rules: Rule[] = contribution ? [...contribution.rules] : [];
      if (!contribution) stats.setsCreated++;

      // Group rows by Rule uniqueness
      const ruleGroups = new Map<string, any[]>();
      setRows.forEach(row => {
        const ruleName = row['Rule Name'] || 'Default Rule';
        const type = row['Type'] || 'Employer';
        const effective = row['Effective From'] || '';
        const geo = row['Geographic Group'] || 'All Regions';
        
        const ruleKey = `${ruleName}_${type}_${effective}_${geo}`.toLowerCase();
        if (!ruleGroups.has(ruleKey)) ruleGroups.set(ruleKey, []);
        ruleGroups.get(ruleKey)!.push(row);
      });

      for (const [_, ruleRows] of ruleGroups.entries()) {
        const firstRow = ruleRows[0];
        const ruleName = firstRow['Rule Name'];
        const type = (firstRow['Type'] === 'Employee' ? ContributionType.Employee : ContributionType.Employer);
        const effectiveFrom = this.formatExcelDate(firstRow['Effective From']);
        
        const geoGroupName = firstRow['Geographic Group'] || 'All Regions';
        const geoGroup = updatedGeoGroups.find(g => g.name.toLowerCase() === geoGroupName.toLowerCase());
        const geoGroupId = geoGroup?.id || '';

        const slabs: Slab[] = ruleRows.map(row => {
          const determinationFieldName = row['Tier Determination Field'] || row['Value Source'];
          const basisFieldName = row['Calculation Basis Field'] || row['Wage Basis'];

          const determinationField = countryConfig.fields.find(f => f.name.toLowerCase() === determinationFieldName?.toString().toLowerCase());
          const basisField = countryConfig.fields.find(f => f.name.toLowerCase() === basisFieldName?.toString().toLowerCase());

          return {
            tierLowerLimit: Number(row['Tier Lower Limit'] || row['Min Threshold'] || 0),
            tierUpperLimit: Number(row['Tier Upper Limit'] || row['Max Threshold'] || 999999999),
            tierDeterminationFieldId: determinationField?.id || '',
            calculationType: (row['Calculation Type'] === 'Fixed' ? CalculationType.Fixed : CalculationType.Percentage),
            rateOrAmount: Number(row['Rate or Amount'] || row['Value'] || 0),
            contributionCap: Number(row['Contribution Cap'] || row['Max Amount'] || 0),
            calculationBasisFieldId: basisField?.id || ''
          };
        });

        // Upsert Rule
        const existingRuleIndex = rules.findIndex(r => 
          r.name.toLowerCase() === ruleName.toLowerCase() && 
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
        stats.rulesUpdated++;
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

    return stats;
  }

  private async ensureFieldsExist(rows: any[], config: CountryConfig): Promise<{ config: CountryConfig, createdCount: number }> {
    const fieldNamesInExcel = new Set<string>();
    rows.forEach(row => {
      const determinationField = row['Tier Determination Field'] || row['Value Source'];
      const basisField = row['Calculation Basis Field'] || row['Wage Basis'];
      if (determinationField) fieldNamesInExcel.add(determinationField.toString().trim());
      if (basisField) fieldNamesInExcel.add(basisField.toString().trim());
    });

    let configChanged = false;
    let createdCount = 0;
    const currentFields = [...config.fields];

    fieldNamesInExcel.forEach(name => {
      if (!name) return;
      if (!currentFields.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        currentFields.push({
          id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          name: name,
          type: 'numeric'
        });
        configChanged = true;
        createdCount++;
      }
    });

    if (configChanged) {
      await this.firestore.updateDocument('countryConfigs', config.id!, { fields: currentFields });
      return { config: { ...config, fields: currentFields }, createdCount };
    }
    return { config, createdCount: 0 };
  }

  private async ensureGeoGroupsExist(rows: any[], countryCode: string, existingGroups: GeoGroup[]): Promise<{ groups: GeoGroup[], createdCount: number }> {
    const geoNamesInExcel = new Set<string>();
    rows.forEach(row => {
      const name = row['Geographic Group'];
      if (name) geoNamesInExcel.add(name.toString().trim());
    });

    const activeGroups = [...existingGroups];
    let createdCount = 0;

    for (const name of geoNamesInExcel) {
      if (!activeGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
        const newGroup: GeoGroup = {
          countryCode,
          name,
          type: 'country',
          selectionMode: 'include',
          entities: []
        };
        const docRef = await this.firestore.addDocument('geoGroups', newGroup);
        activeGroups.push({ ...newGroup, id: docRef.id });
        createdCount++;
      }
    }

    return { groups: activeGroups, createdCount };
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
