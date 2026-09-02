import { Component, ElementRef, signal, input, output, viewChild } from '@angular/core';

/**
 * Mobile bottom sheet (#103): a dialog that slides up from the bottom edge
 * covering most of the screen. The projected content scrolls inside the
 * sheet body; a drag on the handle dismisses it once the finger travels past
 * DISMISS_THRESHOLD_PX, mirroring the Cancel affordance of the hosted form.
 */
@Component({
  selector: 'app-bottom-sheet',
  templateUrl: './bottom-sheet.component.html',
  styleUrl: './bottom-sheet.component.scss',
})
export class BottomSheetComponent {
  static readonly DISMISS_THRESHOLD_PX = 96;

  /** Accessible name for the dialog (e.g. "Quick Add"). */
  label = input('');

  dismissed = output<void>();

  sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');

  dragDistance = signal(0);

  private dragStartY: number | null = null;
  private activePointerId: number | null = null;

  onHandlePointerDown(event: PointerEvent): void {
    this.dragStartY = event.clientY;
    this.activePointerId = event.pointerId;
    const target = event.currentTarget as HTMLElement | null;
    if (typeof target?.setPointerCapture === 'function') {
      target.setPointerCapture(event.pointerId);
    }
  }

  onHandlePointerMove(event: PointerEvent): void {
    if (this.dragStartY === null || event.pointerId !== this.activePointerId) return;
    this.dragDistance.set(Math.max(0, event.clientY - this.dragStartY));
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (this.dragStartY === null || event.pointerId !== this.activePointerId) return;
    const distance = this.dragDistance();
    this.endDrag();
    if (distance >= BottomSheetComponent.DISMISS_THRESHOLD_PX) {
      this.dismissed.emit();
    }
  }

  onHandlePointerCancel(event: PointerEvent): void {
    if (this.dragStartY === null || event.pointerId !== this.activePointerId) return;
    this.endDrag();
  }

  private endDrag(): void {
    this.dragStartY = null;
    this.activePointerId = null;
    this.dragDistance.set(0);
  }
}
