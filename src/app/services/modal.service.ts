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
  private _isModalOpen = signal(false);
  isModalOpen = this._isModalOpen.asReadonly();

  modalConfig = signal<{
    title: string;
    side?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg';
    template?: TemplateRef<any>;
  }>({ title: '' });

  // Confirmation state
  private _isConfirmOpen = signal(false);
  isConfirmOpen = this._isConfirmOpen.asReadonly();
  confirmConfig = signal<ConfirmConfig | null>(null);

  open(modalConfig: { title: string; side?: 'left' | 'right'; size?: 'sm' | 'md' | 'lg'; template: TemplateRef<any> }) {
    this.modalConfig.set(modalConfig);
    this._isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  confirm(confirmConfig: ConfirmConfig) {
    this.confirmConfig.set(confirmConfig);
    this._isConfirmOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close() {
    this._isModalOpen.set(false);
    if (!this._isConfirmOpen()) {
      document.body.style.overflow = '';
    }
  }

  closeConfirm(isConfirmed: boolean) {
    const currentConfirmConfig = this.confirmConfig();
    if (isConfirmed && currentConfirmConfig) {
      currentConfirmConfig.onConfirm();
    }
    this._isConfirmOpen.set(false);
    if (!this._isModalOpen()) {
      document.body.style.overflow = '';
    }
  }
}
