import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { routes } from './app.routes';

const firebaseConfig = {
  apiKey: "AIzaSyAyb09rClNMtqY2Mb0B9o5WwloxTGTN4jE",
  authDomain: "keka-payroll.firebaseapp.com",
  projectId: "keka-payroll",
  storageBucket: "keka-payroll.firebasestorage.app",
  messagingSenderId: "10681154642",
  appId: "1:10681154642:web:f8d624a243c1720628f38b",
  measurementId: "G-T4SED7BPDH"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore())
  ]
};
