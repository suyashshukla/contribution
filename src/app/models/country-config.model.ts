export interface CountryField {
  id: string;
  name: string;
  type: 'numeric' | 'string';
}

export interface CountryConfig {
  id?: string;
  countryCode: string;
  countryName: string;
  fields: CountryField[];
}
