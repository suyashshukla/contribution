import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-ui-loader',
  imports: [CommonModule],
  template: `
    @if (loading.isLoading()) {
      <div class="loader-backdrop">
        <div class="loader-container">
          <div class="spinner"></div>
          <p class="loader-text">Loading...</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .loader-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.3); /* Lighter than modal backdrop */
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fade-in 0.2s ease-out;
    }

    .loader-container {
      background: var(--bg-surface);
      padding: var(--space-xl) var(--space-xxl);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-lg);
      animation: scale-in 0.25s cubic-bezier(0.2, 1, 0.4, 1);
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--color-primary-100);
      border-top-color: var(--color-primary-600);
      border-radius: 50%;
      display: inline-block;
      box-sizing: border-box;
      animation: rotation 0.8s linear infinite;
    }

    .loader-text {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-semibold);
      color: var(--text-heading);
    }

    @keyframes rotation {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scale-in {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiLoaderComponent {
  loading = inject(LoadingService);
}
