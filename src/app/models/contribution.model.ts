export interface Slab {
  min: number;
  max: number;
  valueSourceFieldId: string;
  calcType: 'Fixed' | 'Percentage';
  val: number;
  ceiling: number;
  wageTypeFieldId: string;
}

export interface Rule {
  name: string;
  type: 'Employer' | 'Employee';
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
