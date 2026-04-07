import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'processor', 
    pathMatch: 'full' 
  },
  { 
    path: 'processor', 
    loadComponent: () => import('./components/calculation-engine/calculation-engine').then(module => module.CalculationEngineComponent) 
  },
  { 
    path: 'countries', 
    loadComponent: () => import('./components/country-setup/country-setup').then(module => module.CountrySetupComponent) 
  },
  { 
    path: 'manage-country/:id', 
    loadComponent: () => import('./components/country-wizard/country-wizard').then(module => module.CountryWizardComponent) 
  },
  { 
    path: 'geo-groups', 
    loadComponent: () => import('./components/geo-groups/geo-groups').then(module => module.GeoGroupsComponent) 
  },
  { 
    path: 'rules', 
    loadComponent: () => import('./components/rule-config/rule-config').then(module => module.RuleConfigComponent) 
  }
];
