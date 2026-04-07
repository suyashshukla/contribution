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
  DocumentReference
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private loading = inject(LoadingService);

  getCollection<T>(collectionName: string): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    return new Observable<T[]>(subscriber => {
      let isFirstEmit = true;
      this.loading.show();
      
      const unsubscribe = onSnapshot(colRef, 
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as T));
          
          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          subscriber.next(data);
        },
        error => {
          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmit) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  getCollectionByFilter<T>(collectionName: string, field: string, value: any): Observable<T[]> {
    const colRef = collection(this.firestore, collectionName);
    const q = query(colRef, where(field, '==', value));
    
    return new Observable<T[]>(subscriber => {
      let isFirstEmit = true;
      this.loading.show();

      const unsubscribe = onSnapshot(q, 
        snapshot => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as T));

          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          subscriber.next(data);
        },
        error => {
          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmit) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  getDocument<T>(collectionName: string, id: string): Observable<T | null> {
    const docRef = doc(this.firestore, `${collectionName}/${id}`);
    return new Observable<T | null>(subscriber => {
      let isFirstEmit = true;
      this.loading.show();

      const unsubscribe = onSnapshot(docRef,
        snapshot => {
          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          if (snapshot.exists()) {
            subscriber.next({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            subscriber.next(null);
          }
        },
        error => {
          if (isFirstEmit) {
            this.loading.hide();
            isFirstEmit = false;
          }
          subscriber.error(error);
        }
      );
      return () => {
        if (isFirstEmit) {
          this.loading.hide();
        }
        unsubscribe();
      };
    });
  }

  async addDocument(collectionName: string, data: any): Promise<DocumentReference> {
    this.loading.show();
    try {
      const colRef = collection(this.firestore, collectionName);
      const result = await addDoc(colRef, data);
      return result;
    } finally {
      this.loading.hide();
    }
  }

  async updateDocument(collectionName: string, id: string, data: any): Promise<void> {
    this.loading.show();
    try {
      const docRef = doc(this.firestore, `${collectionName}/${id}`);
      await updateDoc(docRef, data);
    } finally {
      this.loading.hide();
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    this.loading.show();
    try {
      const docRef = doc(this.firestore, `${collectionName}/${id}`);
      await deleteDoc(docRef);
    } finally {
      this.loading.hide();
    }
  }
}
