import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../models/toast.model';

/**
 * Custom toast notification service
 * Zero dependencies - built in-house
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private idCounter = 0;

  /**
   * Show success toast notification
   * @param message - The message to display
   */
  success(message: string) {
    this.show('success', message, 4000);
  }

  /**
   * Show error toast notification
   * @param message - The message to display
   */
  error(message: string) {
    this.show('error', message, 6000);
  }

  /**
   * Show warning toast notification
   * @param message - The message to display
   */
  warning(message: string) {
    this.show('warning', message, 5000);
  }

  /**
   * Show info toast notification
   * @param message - The message to display
   */
  info(message: string) {
    this.show('info', message, 4000);
  }

  /**
   * Show a toast notification
   * @param type - Toast type (success, error, warning, info)
   * @param message - Message to display
   * @param duration - Auto-dismiss duration in milliseconds
   */
  private show(type: ToastType, message: string, duration: number) {
    const id = `toast-${++this.idCounter}`;
    const toast: Toast = {
      id,
      type,
      message,
      duration,
      dismissible: true
    };

    this.toasts.update(toasts => [...toasts, toast]);
  }

  /**
   * Remove a specific toast by id
   * @param id - Toast id to remove
   */
  remove(id: string) {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Close all toasts
   */
  close() {
    this.toasts.set([]);
  }
}
