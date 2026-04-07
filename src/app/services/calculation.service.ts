import { Injectable } from '@angular/core';
import { Contribution, Rule, Slab, ContributionType } from '../models/contribution.model';

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

  calculate(contributions: Contribution[], inputs: Record<string, number>, runDate: string): CalculationResult[] {
    const results: CalculationResult[] = [];

    contributions.forEach(contribution => {
      // Pick the most recent Employer rule on or before runDate
      const employerRule = this.getEffectiveRule(contribution.rules, ContributionType.Employer, runDate);
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

      // Pick the most recent Employee rule on or before runDate
      const employeeRule = this.getEffectiveRule(contribution.rules, ContributionType.Employee, runDate);
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

  private getEffectiveRule(rules: Rule[], type: ContributionType, runDate: string): Rule | null {
    const applicableRules = rules
      .filter(rule => rule.type === type && rule.effectiveFrom <= runDate)
      .sort((ruleA, ruleB) => ruleB.effectiveFrom.localeCompare(ruleA.effectiveFrom));

    return applicableRules.length > 0 ? applicableRules[0] : null;
  }

  private processRule(rule: Rule, inputs: Record<string, number>): number | null {
    // 1. Find the applicable slab based on Value Source Input
    for (const slab of rule.slabs) {
      const valueSourceValue = inputs[slab.valueSourceFieldId] || 0;
      
      if (valueSourceValue >= slab.minimum && valueSourceValue <= slab.maximum) {
        // Slab matched
        const wageTypeValue = inputs[slab.wageTypeFieldId] || 0;
        let amount = 0;

        if (slab.calculationType === 'Percentage') {
          amount = (wageTypeValue * slab.value) / 100;
        } else {
          amount = slab.value;
        }

        // Apply Ceiling
        if (slab.ceiling > 0 && amount > slab.ceiling) {
          amount = slab.ceiling;
        }

        return amount;
      }
    }

    return null;
  }
}
