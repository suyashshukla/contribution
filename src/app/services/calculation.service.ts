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
      // Filter rules by runDate and geographic applicability
      const employerRule = this.getEffectiveRule(contribution.rules, ContributionType.Employer, runDate, selectedGeoGroupId, geoGroups, inputs);
      if (employerRule) {
        const amount = this.processRule(employerRule, inputs);
        if (amount !== null) {
          results.push({
            contributionName: contribution.name,
            ruleName: employerRule.name,
            type: ContributionType.Employer,
            amount: amount
          });
        }
      }

      const employeeRule = this.getEffectiveRule(contribution.rules, ContributionType.Employee, runDate, selectedGeoGroupId, geoGroups, inputs);
      if (employeeRule) {
        const amount = this.processRule(employeeRule, inputs);
        if (amount !== null) {
          results.push({
            contributionName: contribution.name,
            ruleName: employeeRule.name,
            type: ContributionType.Employee,
            amount: amount
          });
        }
      }
    });

    return results;
  }

  private getEffectiveRule(
    rules: Rule[], 
    type: ContributionType, 
    runDate: string, 
    selectedGeoGroupId: string | null,
    geoGroups: GeoGroup[],
    inputs: Record<string, any>
  ): Rule | null {
    const applicableRules = rules
      .filter(rule => {
        // 1. Basic Type and Date filter
        if (rule.type !== type || rule.effectiveFrom > runDate) return false;

        // 2. Explicit selection filter (if user picked a group in simulation dropdown)
        if (selectedGeoGroupId && rule.geoGroupId !== selectedGeoGroupId) return false;

        // 3. Dynamic input matching (if no group selected, or to verify selected group matches inputs)
        const geoGroup = geoGroups.find(groupItem => groupItem.id === rule.geoGroupId);
        if (geoGroup && !this.isLocationMatching(geoGroup, inputs)) return false;

        return true;
      })
      .sort((ruleA, ruleB) => ruleB.effectiveFrom.localeCompare(ruleA.effectiveFrom));

    return applicableRules.length > 0 ? applicableRules[0] : null;
  }

  private isLocationMatching(group: GeoGroup, inputs: Record<string, any>): boolean {
    let inputLocationValue = '';
    
    // Attempt to find relevant input based on group type
    // We assume field IDs might contain keywords like 'country', 'state', 'city'
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

    if (!inputLocationValue) return true; // If no specific input found, assume match to avoid over-filtering

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
