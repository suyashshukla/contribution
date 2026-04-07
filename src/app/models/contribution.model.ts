export enum ContributionType {
  Employer = 'Employer',
  Employee = 'Employee'
}

export interface Slab {
  minimum: number;
  maximum: number;
  valueSourceFieldId: string;
  calculationType: 'Fixed' | 'Percentage';
  value: number;
  ceiling: number;
  wageTypeFieldId: string;
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
