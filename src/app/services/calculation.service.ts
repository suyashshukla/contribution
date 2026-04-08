import { Injectable } from '@angular/core';
import { Contribution, Rule, Slab, ContributionType, CalculationType } from '../models/contribution.model';
import { GeoGroup } from '../models/geo-group.model';

export interface CalculationResult {
  contributionName: string;
  ruleName: string;
  type: ContributionType;
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CalculationService {

  calculate(
    contributions: Contribution[], 
    inputs: Record<string, any>, 
    runDate: string, 
    selectedGeoGroupId: string | null,
    geoGroups: GeoGroup[]
  ): CalculationResult[] {
    const results: CalculationResult[] = [];

    contributions.forEach(contribution => {
      // Get all effective rules (one per unique Name + Type combination)
      const effectiveRules = this.getEffectiveRules(contribution.rules, runDate, selectedGeoGroupId, geoGroups, inputs);
      
      effectiveRules.forEach(rule => {
        const amount = this.processRule(rule, inputs);
        if (amount !== null) {
          results.push({
            contributionName: contribution.name,
            ruleName: rule.name,
            type: rule.type,
            amount: amount
          });
        }
      });
    });

    return results;
  }

  /**
   * Filters and picks the most recent effective version of every uniquely named rule strategy.
   */
  private getEffectiveRules(
    allRules: Rule[], 
    runDate: string, 
    selectedGeoGroupId: string | null,
    geoGroups: GeoGroup[],
    inputs: Record<string, any>
  ): Rule[] {
    // 1. Filter by date and explicit geo selection
    const applicableRules = allRules.filter(rule => {
      // Basic date check
      if (rule.effectiveFrom > runDate) return false;

      // Explicit selection filter (if user picked a group in simulation dropdown)
      if (selectedGeoGroupId && rule.geoGroupId !== selectedGeoGroupId) return false;

      // Dynamic input matching (check if inputs match the rule's target region)
      const geoGroup = geoGroups.find(groupItem => groupItem.id === rule.geoGroupId);
      if (geoGroup && !this.isLocationMatching(geoGroup, inputs)) return false;

      return true;
    });

    // 2. Group by Name + Type and pick the latest effective version for each
    const ruleMap = new Map<string, Rule>();

    applicableRules.forEach(rule => {
      const key = `${rule.name.toLowerCase()}_${rule.type}`;
      const existing = ruleMap.get(key);

      if (!existing || rule.effectiveFrom > existing.effectiveFrom) {
        ruleMap.set(key, rule);
      }
    });

    return Array.from(ruleMap.values());
  }

  private isLocationMatching(group: GeoGroup, inputs: Record<string, any>): boolean {
    let inputLocationValue = '';
    
    // Attempt to find relevant input based on group type
    if (group.type === 'country') {
      const countryKey = Object.keys(inputs).find(key => key.toLowerCase().includes('country'));
      inputLocationValue = countryKey ? inputs[countryKey] : '';
    } else if (group.type === 'state') {
      const stateKey = Object.keys(inputs).find(key => key.toLowerCase().includes('state') || key.toLowerCase().includes('province'));
      inputLocationValue = stateKey ? inputs[stateKey] : '';
    } else if (group.type === 'city') {
      const cityKey = Object.keys(inputs).find(key => key.toLowerCase().includes('city') || key.toLowerCase().includes('district'));
      inputLocationValue = cityKey ? inputs[cityKey] : '';
    }

    if (!inputLocationValue) return true; // Assume match if field not provided to avoid hiding valid rules

    const isIncluded = group.entities.includes(inputLocationValue);
    
    return group.selectionMode === 'include' ? isIncluded : !isIncluded;
  }

  private processRule(rule: Rule, inputs: Record<string, number>): number | null {
    for (const slab of rule.slabs) {
      const determinationValue = inputs[slab.tierDeterminationFieldId] || 0;
      
      if (determinationValue >= slab.tierLowerLimit && determinationValue <= slab.tierUpperLimit) {
        const calculationBasisValue = inputs[slab.calculationBasisFieldId] || 0;
        let amount = 0;

        if (slab.calculationType === CalculationType.Percentage) {
          amount = (calculationBasisValue * slab.rateOrAmount) / 100;
        } else {
          amount = slab.rateOrAmount;
        }

        if (slab.contributionCap > 0 && amount > slab.contributionCap) {
          amount = slab.contributionCap;
        }

        return amount;
      }
    }

    return null;
  }
}
