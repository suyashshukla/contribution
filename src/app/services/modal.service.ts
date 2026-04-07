import { Injectable, signal, TemplateRef } from '@angular/core';

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmBtnClass?: string;
  onConfirm: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private _isOpen = signal(false);
  isOpen = this._isOpen.asReadonly();

  config = signal<{
    title: string;
    side?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg';
    template?: TemplateRef<any>;
  }>({ title: '' });

  // Confirmation state
  private _isConfirmOpen = signal(false);
  isConfirmOpen = this._isConfirmOpen.asReadonly();
  confirmConfig = signal<ConfirmConfig | null>(null);

  open(config: { title: string; side?: 'left' | 'right'; size?: 'sm' | 'md' | 'lg'; template: TemplateRef<any> }) {
    this.config.set(config);
    this._isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  confirm(config: ConfirmConfig) {
    this.confirmConfig.set(config);
    this._isConfirmOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close() {
    this._isOpen.set(false);
    if (!this._isConfirmOpen()) {
      document.body.style.overflow = '';
    }
  }

  closeConfirm(confirmed: boolean) {
    const config = this.confirmConfig();
    if (confirmed && config) {
      config.onConfirm();
    }
    this._isConfirmOpen.set(false);
    if (!this._isOpen()) {
      document.body.style.overflow = '';
    }
  }
}
