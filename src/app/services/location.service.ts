import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private httpClient = inject(HttpClient);
  private baseUrl = 'https://countriesnow.space/api/v0.1';

  getStates(countryName: string): Observable<string[]> {
    return this.httpClient.post<any>(`${this.baseUrl}/countries/states`, { country: countryName }).pipe(
      map(response => response.data.states.map((state: any) => state.name))
    );
  }

  getCities(countryName: string, stateName: string): Observable<string[]> {
    return this.httpClient.post<any>(`${this.baseUrl}/countries/state/cities`, { 
      country: countryName, 
      state: stateName 
    }).pipe(
      map(response => response.data)
    );
  }
}
