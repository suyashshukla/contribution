import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'processor', 
    pathMatch: 'full' 
  },
  { 
    path: 'processor', 
    loadComponent: () => import('./components/calculation-engine/calculation-engine').then(m => m.CalculationEngineComponent) 
  },
  { 
    path: 'countries', 
    loadComponent: () => import('./components/country-setup/country-setup').then(m => m.CountrySetupComponent) 
  },
  { 
    path: 'manage-country/:id', 
    loadComponent: () => import('./components/country-wizard/country-wizard').then(m => m.CountryWizardComponent) 
  },
  { 
    path: 'geo-groups', 
    loadComponent: () => import('./components/geo-groups/geo-groups').then(m => m.GeoGroupsComponent) 
  },
  { 
    path: 'rules', 
    loadComponent: () => import('./components/rule-config/rule-config').then(m => m.RuleConfigComponent) 
  }
];
