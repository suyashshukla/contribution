export type GeoType = 'country' | 'state' | 'city';

export interface GeoGroup {
  id?: string;
  countryCode: string; // Added to link to country wizard
  name: string;
  type: GeoType;
  entities: string[];
}
