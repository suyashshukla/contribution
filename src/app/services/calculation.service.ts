import { Injectable } from '@angular/core';
import { Contribution, Rule, Slab } from '../models/contribution.model';

export interface CalculationResult {
  ruleName: string;
  type: 'Employer' | 'Employee';
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CalculationService {

  calculate(contributions: Contribution[], inputs: Record<string, number>): CalculationResult[] {
    const results: CalculationResult[] = [];

    contributions.forEach(contribution => {
      contribution.rules.forEach(rule => {
        const result = this.processRule(rule, inputs);
        if (result !== null) {
          results.push({
            ruleName: rule.name,
            type: rule.type,
            amount: result
          });
        }
      });
    });

    return results;
  }

  private processRule(rule: Rule, inputs: Record<string, number>): number | null {
    // 1. Find the applicable slab based on Value Source Input
    for (const slab of rule.slabs) {
      const valueSourceVal = inputs[slab.valueSourceFieldId] || 0;
      
      if (valueSourceVal >= slab.min && valueSourceVal <= slab.max) {
        // Slab matched
        const wageTypeVal = inputs[slab.wageTypeFieldId] || 0;
        let amount = 0;

        if (slab.calcType === 'Percentage') {
          amount = (wageTypeVal * slab.val) / 100;
        } else {
          amount = slab.val;
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
