import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { UiLoaderComponent } from './components/shared/ui-loader';
import { UiModalComponent } from './components/shared/ui-modal';
import { UiConfirmModalComponent } from './components/shared/ui-confirm-modal';
import { ToastContainerComponent } from './components/shared/toast-container.component';
import { 
  IconChartComponent, 
  IconGlobeComponent
} from './components/shared/icons';
import { ModalService } from './services/modal.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',

  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive, 
    UiLoaderComponent, 
    UiModalComponent, 
    UiConfirmModalComponent,
    ToastContainerComponent,
    IconChartComponent,
    IconGlobeComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('contribution');
  modal = inject(ModalService);
}
