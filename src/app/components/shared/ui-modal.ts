import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ui-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()"></div>
    <div class="modal-window" 
         [class.modal-size-sm]="size() === 'sm'"
         [class.modal-size-md]="size() === 'md'"
         [class.modal-size-lg]="size() === 'lg'"
         [class.modal-size-xl]="size() === 'xl'"
         [class.modal-side-right]="side() === 'right'"
         [class.modal-side-left]="side() === 'left'"
         [class.modal-centered]="!side()"
         role="dialog"
         aria-modal="true"
         [attr.aria-label]="title()">

      <header class="modal-header">
        <h2 class="modal-title">{{ title() }}</h2>
        <button type="button" class="modal-close-btn" (click)="close.emit()" aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>

      <div class="modal-content">
        <ng-content></ng-content>
      </div>
      
      @if (false) {
        <footer class="modal-footer">
          <!-- Optional footer content, e.g., for actions within the modal, will be projected here if needed -->
          <!-- Default modal service does not typically pass footer content, so this is hidden for now -->
        </footer>
      }
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.4); /* Use rgba directly for overlay */
      backdrop-filter: blur(8px);
      animation: fade-in 0.2s ease-out;
    }

    .modal-window {
      position: fixed;
      background-color: var(--bg-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10000;
      max-height: 90vh;
      max-width: 90vw;
    }

    .modal-centered {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: scale-in 0.25s cubic-bezier(0.2, 1, 0.4, 1);
    }

    .modal-size-sm { width: 400px; }
    .modal-size-md { width: 600px; }
    .modal-size-lg { width: 800px; }
    .modal-size-xl { width: 950px; }

    .modal-side-right, .modal-side-left {
      top: 0;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      max-width: none;
    }

    .modal-side-right {
      right: 0;
      left: auto;
      animation: slide-right-in 0.28s cubic-bezier(0.2, 1, 0.4, 1);
    }
    
    .modal-side-left {
      left: 0;
      right: auto;
      animation: slide-left-in 0.28s cubic-bezier(0.2, 1, 0.4, 1);
    }

    @media (max-width: 768px) {
      .modal-window {
        width: 95vw !important;
        max-height: 95vh;
        border-radius: var(--radius-lg);
      }

      .modal-centered {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .modal-side-right, .modal-side-left {
        width: 100vw !important;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }

      .modal-header {
        padding: var(--space-md);
      }

      .modal-body {
        padding: var(--space-md);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-lg) var(--space-xl);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .modal-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-heading);
    }

    .modal-close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-xs);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      transition: var(--transition-ease);
    }

    .modal-close-btn:hover {
      color: var(--text-heading);
      background-color: var(--color-neutral-100);
    }

    .modal-close-btn svg {
      display: block; /* Remove extra space below SVG */
      width: 20px;
      height: 20px;
    }

    .modal-content {
      flex-grow: 1;
      padding: var(--space-xl);
      overflow-y: auto;
      overflow-x: hidden;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-xl);
      border-top: 1px solid var(--border-color);
      background-color: var(--bg-canvas);
      flex-shrink: 0;
    }

    /* Animations */
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scale-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes slide-right-in {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes slide-left-in {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiModalComponent {
  title = input.required<string>();
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  side = input<'left' | 'right'>();
  close = output<void>();
  
  isOpen = computed(() => true); // Mock isOpen for template binding, actual control is via service
}
