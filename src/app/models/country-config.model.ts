export interface CountryField {
  id: string;
  name: string;
  type: 'numeric' | 'date' | 'string';
}

export interface CountryConfig {
  id?: string;
  countryCode: string;
  countryName: string;
  fields: CountryField[];
}
