import { Component, ElementRef, signal, input, output, viewChild, inject, DOCUMENT, OnInit, OnDestroy } from '@angular/core';

/**
 * Mobile bottom sheet (#103): a dialog that slides up from the bottom edge
 * covering most of the screen. The projected content scrolls inside the
 * sheet body; a drag on the handle dismisses it once the finger travels past
 * DISMISS_THRESHOLD_PX, mirroring the Cancel affordance of the hosted form.
 *
 * Modal semantics (#106): while the sheet is open the body scroll is locked
 * and Tab is trapped inside the dialog, so keyboard focus can never reach
 * the page behind it. The scrim question was decided in ADR 0015 — the
 * sheet ships without one.
 */
@Component({
  selector: 'app-bottom-sheet',
  templateUrl: './bottom-sheet.component.html',
  styleUrl: './bottom-sheet.component.scss',
  host: { '(document:keydown)': 'onDocKeydown($event)' },
})
export class BottomSheetComponent implements OnInit, OnDestroy {
  static readonly DISMISS_THRESHOLD_PX = 96;

  private static readonly FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  /** Accessible name for the dialog (e.g. "Transaction form"). */
  label = input('');

  dismissed = output<void>();

  sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');

  dragDistance = signal(0);

  private readonly document = inject(DOCUMENT);
  private bodyOverflowBeforeLock: string | null = null;
  private dragStartY: number | null = null;
  private activePointerId: number | null = null;

  ngOnInit(): void {
    this.bodyOverflowBeforeLock = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.bodyOverflowBeforeLock ?? '';
  }

  /**
   * Focus trap (#106): while the sheet is open, Tab/Shift+Tab cycle within
   * the dialog. Bound at document level so a Tab pressed while focus sits
   * outside the sheet (e.g. after clicking the page behind) is still caught.
   * Only the wrap-around edges are hijacked; Tab between focusable elements
   * keeps native browser ordering. Non-Tab keys (Escape, the form's own
   * shortcuts) pass through untouched to the document-level handlers.
   */
  onDocKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusables = this.focusableElements();
    if (focusables.length === 0) return;

    const active = this.document.activeElement as HTMLElement | null;
    if (active && this.sheet().nativeElement.contains(active)) {
      const index = focusables.indexOf(active);
      if (event.shiftKey && index > 0) return;
      if (!event.shiftKey && index > -1 && index < focusables.length - 1) return;
    }

    event.preventDefault();
    this.focusTarget(event.shiftKey, focusables).focus();
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(
      this.sheet().nativeElement.querySelectorAll<HTMLElement>(BottomSheetComponent.FOCUSABLE_SELECTOR),
    ).filter((el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : true));
  }

  private focusTarget(shiftKey: boolean, focusables: HTMLElement[]): HTMLElement {
    const wrapTarget = shiftKey ? focusables[focusables.length - 1]! : focusables[0]!;
    const active = this.document.activeElement as HTMLElement | null;
    const index =
      active && this.sheet().nativeElement.contains(active) ? focusables.indexOf(active) : -1;
    if (shiftKey) return index <= 0 ? wrapTarget : focusables[index - 1]!;
    return index === -1 || index === focusables.length - 1 ? wrapTarget : focusables[index + 1]!;
  }

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
