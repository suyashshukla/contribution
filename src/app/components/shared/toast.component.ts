import { Component, ChangeDetectionStrategy, signal, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast } from '../../models/toast.model';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="toast toast-{{toast().type}}"
      [class.toast-exit]="isExiting()"
      role="alert"
      [attr.aria-live]="toast().type === 'error' ? 'assertive' : 'polite'"
    >
      <div class="toast-icon">
        @switch (toast().type) {
          @case ('success') {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" fill="currentColor"/>
            </svg>
          }
          @case ('error') {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z" fill="currentColor"/>
            </svg>
          }
          @case ('warning') {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z" fill="currentColor"/>
            </svg>
          }
          @case ('info') {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" fill="currentColor"/>
            </svg>
          }
        }
      </div>
      
      <div class="toast-message">{{ toast().message }}</div>
      
      @if (toast().dismissible) {
        <button 
          class="toast-close" 
          (click)="onClose()"
          aria-label="Close notification"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12.854 3.146a.5.5 0 0 1 0 .708L8.707 8l4.147 4.146a.5.5 0 0 1-.708.708L8 8.707l-4.146 4.147a.5.5 0 0 1-.708-.708L7.293 8 3.146 3.854a.5.5 0 1 1 .708-.708L8 7.293l4.146-4.147a.5.5 0 0 1 .708 0z" fill="currentColor"/>
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: 12px;
      animation: slideInRight 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      backdrop-filter: blur(10px);
      min-width: 300px;
      max-width: 420px;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .toast:hover {
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      transform: translateY(-2px);
    }

    .toast-exit {
      animation: fadeOut 0.2s ease-out forwards;
    }

    .toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: white;
    }

    .toast-message {
      flex: 1;
      font-size: 15px;
      font-weight: 500;
      line-height: 1.5;
      color: white;
    }

    .toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: white;
      opacity: 0.8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .toast-close:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }

    .toast-success {
      background: linear-gradient(135deg, #10b981, #059669);
      border-color: #059669;
    }

    .toast-error {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border-color: #dc2626;
    }

    .toast-warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border-color: #d97706;
    }

    .toast-info {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-color: #2563eb;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
        transform: translateX(20px);
      }
    }
  `]
})
export class ToastComponent {
  toast = input.required<Toast>();
  onDismiss = input<(toastId: string) => void>();
  
  isExiting = signal(false);

  constructor() {
    // Auto-dismiss after duration
    effect(() => {
      const currentToast = this.toast();
      if (currentToast.duration > 0) {
        setTimeout(() => {
          this.onClose();
        }, currentToast.duration);
      }
    });
  }

  onClose() {
    this.isExiting.set(true);
    // Wait for animation to complete
    setTimeout(() => {
      const dismissFunction = this.onDismiss();
      if (dismissFunction) {
        dismissFunction(this.toast().id);
      }
    }, 200);
  }
}
