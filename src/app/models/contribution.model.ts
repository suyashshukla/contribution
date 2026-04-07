export enum ContributionType {
  Employer = 'Employer',
  Employee = 'Employee'
}

export enum CalculationType {
  Fixed = 'Fixed',
  Percentage = 'Percentage'
}

export interface Slab {
  tierLowerLimit: number;
  tierUpperLimit: number;
  tierDeterminationFieldId: string;
  calculationType: CalculationType;
  rateOrAmount: number;
  calculationBasisFieldId: string;
  contributionCap: number;
}

export interface Rule {
  name: string;
  type: ContributionType;
  effectiveFrom: any; // Using any for simplicity in date handling from Firestore
  geoGroupId: string;
  slabs: Slab[];
}

export interface Contribution {
  id?: string;
  name: string;
  countryCode: string; // Linking contribution to a country for schema lookup
  rules: Rule[];
}
