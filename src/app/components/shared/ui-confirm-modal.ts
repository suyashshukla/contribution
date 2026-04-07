import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ui-confirm-modal',
  imports: [CommonModule],
  template: `
    <div class="confirm-modal-backdrop"></div>
    <div class="confirm-modal-window" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <div class="confirm-modal-content">
        <h2 class="confirm-modal-title">{{ title() }}</h2>
        <p class="confirm-modal-message">{{ message() }}</p>
      </div>
      
      <div class="confirm-modal-actions">
        <button type="button" class="btn btn-secondary" (click)="cancel.emit()">{{ cancelLabel() }}</button>
        <button type="button" class="btn" [class]="confirmBtnClass()" (click)="confirm.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000; /* Just above regular modals */
      background: rgba(0, 0, 0, 0.6); /* Darker overlay for confirmation */
      backdrop-filter: blur(6px);
      animation: fade-in 0.2s ease-out;
    }

    .confirm-modal-window {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--bg-surface);
      border-radius: var(--radius-xl);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10001; /* Above backdrop */
      animation: scale-in 0.25s cubic-bezier(0.2, 1, 0.4, 1);
      width: 440px; /* Specific width for confirm modal */
      max-width: 90vw;
      padding: var(--space-xxl);
      text-align: center;
    }

    .confirm-modal-content {
      margin-bottom: var(--space-xl);
    }

    .confirm-modal-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-heading);
      margin-bottom: var(--space-md);
    }

    .confirm-modal-message {
      font-size: var(--font-size-base);
      color: var(--text-body);
      line-height: var(--line-height-loose);
      margin-bottom: 0; /* Handled by content margin */
    }

    .confirm-modal-actions {
      display: flex;
      justify-content: center;
      gap: var(--space-md);
      margin-top: var(--space-xl);
    }

    /* Animations (re-using global definitions if possible, but defining locally for clarity) */
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scale-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `]
})
export class UiConfirmModalComponent {
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed with this operation?');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  confirmBtnClass = input<string>('btn-primary');

  confirm = output<void>();
  cancel = output<void>();
}
