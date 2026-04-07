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
  private formBuilder = inject(FormBuilder);
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
  globalCountries = GLOBAL_COUNTRIES;
  
  countryName = computed(() => {
    const currentCountryCode = this.countryCode();
    return GLOBAL_COUNTRIES.find(countryItem => countryItem.code === currentCountryCode || countryItem.iso2 === currentCountryCode)?.name || null;
  });

  geoGroups$: Observable<GeoGroup[]> = toObservable(this.countryCode).pipe(
    switchMap(currentCountryCode => {
      if (!currentCountryCode) return of([]);
      return this.firestore.getCollection<GeoGroup>('geoGroups').pipe(
        map(geoGroups => geoGroups.filter(geoGroup => geoGroup.countryCode === currentCountryCode))
      );
    })
  );

  form = this.formBuilder.group({
    name: ['', Validators.required],
    type: ['country' as GeoType, Validators.required],
    selectionMode: ['include' as 'include' | 'exclude'],
    tempCountry: [null as string | null],
    tempState: [null as string | null],
    tempCity: [null as string | null]
  });

  // Convert form values to signals for proper effect tracking
  typeSignal = toSignal(this.form.controls.type.valueChanges, { initialValue: 'country' as GeoType });
  stateSignal = toSignal(this.form.controls.tempState.valueChanges, { initialValue: null as string | null });
  selectionModeSignal = toSignal(this.form.controls.selectionMode.valueChanges, { initialValue: 'include' as 'include' | 'exclude' });

  constructor() {
    // Load states when country or type changes
    effect(() => {
      const currentCountryName = this.countryName();
      const currentType = this.typeSignal();
      
      if (currentCountryName && (currentType === 'state' || currentType === 'city')) {
        untracked(() => this.loadStates(currentCountryName));
      } else {
        this.states.set([]);
      }
    });

    // Load cities when state selection changes
    effect(() => {
      const currentCountryName = this.countryName();
      const currentType = this.typeSignal();
      const currentState = this.stateSignal();

      if (currentCountryName && currentType === 'city' && currentState) {
        untracked(() => this.loadCities(currentCountryName, currentState));
      } else {
        this.cities.set([]);
      }
    });
  }

  loadStates(currentCountryName: string) {
    this.isLoadingLocations.set(true);
    this.locationService.getStates(currentCountryName).pipe(
      catchError(error => {
        console.error('LocationService Error (States):', error);
        return of([]);
      })
    ).subscribe(statesData => {
      this.states.set(statesData);
      this.isLoadingLocations.set(false);
    });
  }

  loadCities(countryName: string, stateName: string) {
    this.isLoadingLocations.set(true);
    this.locationService.getCities(countryName, stateName).pipe(
      catchError(error => {
        console.error('LocationService Error (Cities):', error);
        return of([]);
      })
    ).subscribe(citiesData => {
      this.cities.set(citiesData);
      this.isLoadingLocations.set(false);
    });
  }

  addEntity() {
    const type = this.form.controls.type.value;
    let value = '';
    if (type === 'country') value = this.form.controls.tempCountry.value || '';
    if (type === 'state') value = this.form.controls.tempState.value || '';
    if (type === 'city') value = this.form.controls.tempCity.value || '';

    if (value && !this.selectedEntities().includes(value)) {
      this.selectedEntities.update(currentEntities => [...currentEntities, value]);
    }
  }

  removeEntity(entity: string) {
    this.selectedEntities.update(currentEntities => currentEntities.filter(currentEntity => currentEntity !== entity));
  }

  openAddModal() {
    this.editingGroupId.set(null);
    this.form.reset({ type: 'country', name: '', selectionMode: 'include', tempCountry: null, tempState: null, tempCity: null });
    this.selectedEntities.set([]);
    this.modal.open({
      title: 'Create geographic group',
      template: this.formModalTemplate
    });
  }

  openEditModal(geoGroup: GeoGroup) {
    this.editingGroupId.set(geoGroup.id!);
    this.form.reset({
      name: geoGroup.name,
      type: geoGroup.type,
      selectionMode: geoGroup.selectionMode,
      tempCountry: null,
      tempState: null,
      tempCity: null
    });
    this.selectedEntities.set([...geoGroup.entities]);
    this.modal.open({
      title: 'Edit geographic group',
      template: this.formModalTemplate
    });
  }

  async save() {
    if (this.form.invalid || !this.countryCode() || this.selectedEntities().length === 0 || this.isSaving()) return;
    
    try {
      this.isSaving.set(true);
      const { name, type, selectionMode } = this.form.getRawValue();
      
      const geoGroup: GeoGroup = {
        countryCode: this.countryCode()!,
        name: name!,
        type: type as GeoType,
        selectionMode: selectionMode as 'include' | 'exclude',
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

  requestDelete(geoGroupId: string) {
    this.modal.confirm({
      title: 'Archive group',
      message: 'Removing this geographic group may affect active contribution rules targeting these regions.',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => this.confirmDelete(geoGroupId)
    });
  }

  async confirmDelete(geoGroupId: string) {
    await this.firestore.deleteDocument('geoGroups', geoGroupId);
  }

  closeModal() {
    this.modal.close();
  }

  getFlagUrl(countryCode: string | null | undefined) {
    if (!countryCode) return '';
    const countryItem = GLOBAL_COUNTRIES.find(country => country.code === countryCode || country.iso2 === countryCode);
    const isoCode = countryItem?.iso2 || countryCode;
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }
}
