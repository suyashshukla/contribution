import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `
    <svg 
      [attr.width]="size()" 
      [attr.height]="size()" 
      [attr.viewBox]="viewBox()"
      [attr.fill]="fill()" 
      [attr.stroke]="stroke()" 
      [attr.stroke-width]="strokeWidth()" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      [attr.aria-label]="label()"
      [class]="class()">
      <ng-content></ng-content>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      flex-shrink: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiIconComponent {
  size = input<number>(24);
  viewBox = input<string>('0 0 24 24');
  fill = input<string>('none');
  stroke = input<string>('currentColor');
  strokeWidth = input<number>(2);
  label = input<string>('');
  class = input<string>('');
}
