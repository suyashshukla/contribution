import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private http = inject(HttpClient);
  private baseUrl = 'https://countriesnow.space/api/v0.1';

  getStates(countryName: string): Observable<string[]> {
    return this.http.post<any>(`${this.baseUrl}/countries/states`, { country: countryName }).pipe(
      map(res => res.data.states.map((s: any) => s.name))
    );
  }

  getCities(countryName: string, stateName: string): Observable<string[]> {
    return this.http.post<any>(`${this.baseUrl}/countries/state/cities`, { 
      country: countryName, 
      state: stateName 
    }).pipe(
      map(res => res.data)
    );
  }
}
