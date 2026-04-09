import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot,
  DocumentReference,
  collectionGroup,
  getDocs
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private loading = inject(LoadingService);

  getCollection<T>(collectionName: string): Observable<T[]> {
    const collectionReference = collection(this.firestore, collectionName);
    return new Observable<T[]>(subscriber => {
      let isFirstEmission = true;
      this.loading.show();
      
      const unsubscribe = onSnapshot(collectionReference, 
        snapshot => {
          const data = snapshot.docs.map(documentSnapshot => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
          } as T));
          
          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          subscriber.next(data);
        },
        error => {
          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmission) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  getCollectionByFilter<T>(collectionName: string, field: string, value: any): Observable<T[]> {
    const collectionReference = collection(this.firestore, collectionName);
    const firestoreQuery = query(collectionReference, where(field, '==', value));
    
    return new Observable<T[]>(subscriber => {
      let isFirstEmission = true;
      this.loading.show();

      const unsubscribe = onSnapshot(firestoreQuery, 
        snapshot => {
          const data = snapshot.docs.map(documentSnapshot => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
          } as T));

          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          subscriber.next(data);
        },
        error => {
          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmission) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  getDocument<T>(collectionName: string, documentId: string): Observable<T | null> {
    const documentReference = doc(this.firestore, `${collectionName}/${documentId}`);
    return new Observable<T | null>(subscriber => {
      let isFirstEmission = true;
      this.loading.show();

      const unsubscribe = onSnapshot(documentReference,
        snapshot => {
          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          if (snapshot.exists()) {
            subscriber.next({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            subscriber.next(null);
          }
        },
        error => {
          if (isFirstEmission) {
            this.loading.hide();
            isFirstEmission = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmission) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  async addDocument(collectionName: string, documentData: any): Promise<DocumentReference> {
    this.loading.show();
    try {
      const collectionReference = collection(this.firestore, collectionName);
      const result = await addDoc(collectionReference, documentData);
      return result;
    } finally {
      this.loading.hide();
    }
  }

  async updateDocument(collectionName: string, documentId: string, documentData: any): Promise<void> {
    this.loading.show();
    try {
      const documentReference = doc(this.firestore, `${collectionName}/${documentId}`);
      await updateDoc(documentReference, documentData);
    } finally {
      this.loading.hide();
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    this.loading.show();
    try {
      const documentReference = doc(this.firestore, `${collectionName}/${documentId}`);
      await deleteDoc(documentReference);
    } finally {
      this.loading.hide();
    }
  }
}
