import { Component, ChangeDetectionStrategy, inject, input, signal, computed, effect, untracked, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../services/firestore.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { LocationService } from '../../services/location.service';
import { GeoGroup, GeoType } from '../../models/geo-group.model';
import { GLOBAL_COUNTRIES } from '../../models/countries.data';
import { NgSelectModule } from '@ng-select/ng-select';
import { Observable, map, of, catchError, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-geo-groups',

  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './geo-groups.html',
  styleUrl: './geo-groups.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeoGroupsComponent {
  private fb = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private locationService = inject(LocationService);

  @ViewChild('formModal') formModalTemplate!: TemplateRef<any>;

  countryCode = input<string | null | undefined>(null);
  isSaving = signal(false);
  isLoadingLocations = signal(false);
  editingGroupId = signal<string | null>(null);
  
  states = signal<string[]>([]);
  cities = signal<string[]>([]);
  selectedEntities = signal<string[]>([]);
  
  countryName = computed(() => {
    const code = this.countryCode();
    return GLOBAL_COUNTRIES.find(c => c.code === code || c.iso2 === code)?.name || null;
  });

  geoGroups$: Observable<GeoGroup[]> = toObservable(this.countryCode).pipe(
    switchMap(code => {
      if (!code) return of([]);
      return this.firestore.getCollection<GeoGroup>('geoGroups').pipe(
        map(groups => groups.filter(g => g.countryCode === code))
      );
    })
  );

  form = this.fb.group({
    name: ['', Validators.required],
    type: ['country' as GeoType, Validators.required],
    tempState: [''],
    tempCity: ['']
  });

  // Convert form values to signals for proper effect tracking
  typeSignal = toSignal(this.form.controls.type.valueChanges, { initialValue: 'country' as GeoType });
  stateSignal = toSignal(this.form.controls.tempState.valueChanges, { initialValue: '' });

  constructor() {
    // Load states when country or type changes
    effect(() => {
      const name = this.countryName();
      const type = this.typeSignal();
      
      if (name && (type === 'state' || type === 'city')) {
        untracked(() => this.loadStates(name));
      } else {
        this.states.set([]);
      }
    });

    // Load cities when state selection changes
    effect(() => {
      const name = this.countryName();
      const type = this.typeSignal();
      const state = this.stateSignal();

      if (name && type === 'city' && state) {
        untracked(() => this.loadCities(name, state));
      } else {
        this.cities.set([]);
      }
    });
  }

  loadStates(name: string) {
    this.isLoadingLocations.set(true);
    this.locationService.getStates(name).pipe(
      catchError(err => {
        console.error('LocationService Error (States):', err);
        return of([]);
      })
    ).subscribe(data => {
      this.states.set(data);
      this.isLoadingLocations.set(false);
    });
  }

  loadCities(country: string, state: string) {
    this.isLoadingLocations.set(true);
    this.locationService.getCities(country, state).pipe(
      catchError(err => {
        console.error('LocationService Error (Cities):', err);
        return of([]);
      })
    ).subscribe(data => {
      this.cities.set(data);
      this.isLoadingLocations.set(false);
    });
  }

  addEntity() {
    const type = this.form.controls.type.value;
    let value = '';
    if (type === 'country') value = this.countryName() || '';
    if (type === 'state') value = this.form.controls.tempState.value || '';
    if (type === 'city') value = this.form.controls.tempCity.value || '';

    if (value && !this.selectedEntities().includes(value)) {
      this.selectedEntities.update(current => [...current, value]);
    }
  }

  removeEntity(entity: string) {
    this.selectedEntities.update(current => current.filter(e => e !== entity));
  }

  openAddModal() {
    this.editingGroupId.set(null);
    this.form.reset({ type: 'country', name: '', tempState: '', tempCity: '' });
    this.selectedEntities.set([]);
    this.modal.open({
      title: 'Create geographic group',
      template: this.formModalTemplate
    });
  }

  openEditModal(group: GeoGroup) {
    this.editingGroupId.set(group.id!);
    this.form.reset({
      name: group.name,
      type: group.type,
      tempState: '',
      tempCity: ''
    });
    this.selectedEntities.set([...group.entities]);
    this.modal.open({
      title: 'Edit geographic group',
      template: this.formModalTemplate
    });
  }

  async save() {
    if (this.form.invalid || !this.countryCode() || this.selectedEntities().length === 0 || this.isSaving()) return;
    
    try {
      this.isSaving.set(true);
      const { name, type } = this.form.getRawValue();
      const geoGroup: GeoGroup = {
        countryCode: this.countryCode()!,
        name: name!,
        type: type as GeoType,
        entities: this.selectedEntities()
      };
      
      if (this.editingGroupId()) {
        await this.firestore.updateDocument('geoGroups', this.editingGroupId()!, geoGroup);
        this.toast.success('Geographic group updated successfully.');
      } else {
        await this.firestore.addDocument('geoGroups', geoGroup);
        this.toast.success('Geographic group created successfully.');
      }
      
      this.modal.close();
    } catch (error: any) {
      console.error('GeoGroup Save Error:', error);
      this.toast.error(error.message || 'Error saving group.');
    } finally {
      this.isSaving.set(false);
    }
  }

  requestDelete(id: string) {
    this.modal.confirm({
      title: 'Archive group',
      message: 'Removing this geographic group may affect active contribution rules targeting these regions.',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(id)
    });
  }

  async confirmDelete(id: string) {
    await this.firestore.deleteDocument('geoGroups', id);
  }

  closeModal() {
    this.modal.close();
  }

  getFlagUrl(code: string | null | undefined) {
    if (!code) return '';
    const country = GLOBAL_COUNTRIES.find(c => c.code === code || c.iso2 === code);
    const iso2 = country?.iso2 || code;
    return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
  }
}
