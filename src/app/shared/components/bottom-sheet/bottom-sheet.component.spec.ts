import { Component, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BottomSheetComponent } from './bottom-sheet.component';

function pointerEvent(type: string, clientY: number, pointerId = 1): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperty(event, 'clientY', { value: clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

@Component({
  imports: [BottomSheetComponent],
  template: `
    <button class="outside-before" type="button">Outside before</button>
    <app-bottom-sheet label="Capture form">
      <div class="projected">Projected</div>
      <input class="sheet-first" type="text" aria-label="First field" />
      <button class="sheet-middle" type="button">Save</button>
      <input class="sheet-last" type="text" aria-label="Last field" />
    </app-bottom-sheet>
    <button class="outside-after" type="button">Outside after</button>
  `,
})
class TestHostComponent {
  sheet = viewChild.required(BottomSheetComponent);
}

describe('BottomSheetComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: BottomSheetComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance.sheet();
    fixture.detectChanges();
  });

  function handleEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.sheet-handle') as HTMLElement;
  }

  function dragHandle(fromY: number, toY: number, pointerId = 1): void {
    handleEl().dispatchEvent(pointerEvent('pointerdown', fromY, pointerId));
    handleEl().dispatchEvent(pointerEvent('pointermove', toY, pointerId));
    handleEl().dispatchEvent(pointerEvent('pointerup', toY, pointerId));
  }

  function sheetEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.sheet') as HTMLElement;
  }

  function keydownEvent(key: string, shiftKey = false): KeyboardEvent {
    return new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  }

  it('renders as a modal dialog with an accessible name and the projected content', () => {
    const sheet = fixture.nativeElement.querySelector('.sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.getAttribute('aria-label')).toBe('Capture form');

    const body = sheet.querySelector('.sheet-body') as HTMLElement;
    expect(body.querySelector('.projected')).not.toBeNull();
  });

  it('emits dismissed when the handle is dragged down past the threshold', () => {
    const spy = vi.fn();
    component.dismissed.subscribe(spy);

    dragHandle(100, 100 + BottomSheetComponent.DISMISS_THRESHOLD_PX);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when the drag stays within the threshold', () => {
    const spy = vi.fn();
    component.dismissed.subscribe(spy);

    dragHandle(100, 100 + BottomSheetComponent.DISMISS_THRESHOLD_PX - 1);

    expect(spy).not.toHaveBeenCalled();
  });

  it('never dismisses on an upward drag', () => {
    const spy = vi.fn();
    component.dismissed.subscribe(spy);

    dragHandle(300, 100);

    expect(spy).not.toHaveBeenCalled();
  });

  it('follows the pointer while dragging and springs back on a short release', () => {
    handleEl().dispatchEvent(pointerEvent('pointerdown', 100));
    handleEl().dispatchEvent(pointerEvent('pointermove', 140));

    fixture.detectChanges();
    const sheet = fixture.nativeElement.querySelector('.sheet') as HTMLElement;
    expect(sheet.style.transform).toBe('translateY(40px)');

    handleEl().dispatchEvent(pointerEvent('pointerup', 140));
    fixture.detectChanges();
    expect(sheet.style.transform).toBe('translateY(0px)');
  });

  it('ignores a second pointer while one drag is in progress', () => {
    const spy = vi.fn();
    component.dismissed.subscribe(spy);

    dragHandle(100, 100 + BottomSheetComponent.DISMISS_THRESHOLD_PX, 1);

    // The release above already ended the drag; a stray second pointer's
    // move must not re-open the drag state or trigger a dismissal.
    handleEl().dispatchEvent(pointerEvent('pointermove', 1000, 2));
    handleEl().dispatchEvent(pointerEvent('pointerup', 1000, 2));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('aborts the drag on pointercancel without dismissing', () => {
    const spy = vi.fn();
    component.dismissed.subscribe(spy);

    const threshold = 100 + BottomSheetComponent.DISMISS_THRESHOLD_PX;
    handleEl().dispatchEvent(pointerEvent('pointerdown', 100));
    handleEl().dispatchEvent(pointerEvent('pointermove', threshold));
    handleEl().dispatchEvent(pointerEvent('pointercancel', threshold));

    expect(spy).not.toHaveBeenCalled();

    handleEl().dispatchEvent(pointerEvent('pointermove', 100));
    fixture.detectChanges();
    const sheet = fixture.nativeElement.querySelector('.sheet') as HTMLElement;
    expect(sheet.style.transform).toBe('translateY(0px)');
  });

  describe('modal semantics (#106)', () => {
    it('locks body scroll while the sheet is open and restores it on close', () => {
      expect(document.body.style.overflow).toBe('hidden');

      fixture.destroy();

      expect(document.body.style.overflow).toBe('');
    });

    it('wraps Tab from the last focusable element back to the first inside the sheet', () => {
      const last = fixture.nativeElement.querySelector('.sheet-last') as HTMLElement;
      last.focus();
      expect(document.activeElement).toBe(last);

      sheetEl().dispatchEvent(keydownEvent('Tab'));

      const first = fixture.nativeElement.querySelector('.sheet-first') as HTMLElement;
      expect(document.activeElement).toBe(first);
    });

    it('wraps Shift+Tab from the first focusable element to the last inside the sheet', () => {
      const first = fixture.nativeElement.querySelector('.sheet-first') as HTMLElement;
      first.focus();
      expect(document.activeElement).toBe(first);

      sheetEl().dispatchEvent(keydownEvent('Tab', true));

      const last = fixture.nativeElement.querySelector('.sheet-last') as HTMLElement;
      expect(document.activeElement).toBe(last);
    });

    it('leaves Tab between inner elements to native focus ordering', () => {
      const first = fixture.nativeElement.querySelector('.sheet-first') as HTMLElement;
      first.focus();

      const event = keydownEvent('Tab');
      sheetEl().dispatchEvent(event);

      // The trap only hijacks the wrap-around edges; jsdom does not
      // implement native Tab movement, so focus stays put.
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(first);
    });

    it('pulls focus into the sheet when Tab arrives while focus is outside it', () => {
      const outside = fixture.nativeElement.querySelector('.outside-before') as HTMLElement;
      outside.focus();
      expect(document.activeElement).toBe(outside);

      // Dispatch from the outside element itself: the trap listens at
      // document level, so a real Tab pressed with focus behind the sheet
      // is caught even though the keydown never passes through the sheet.
      outside.dispatchEvent(keydownEvent('Tab'));

      const first = fixture.nativeElement.querySelector('.sheet-first') as HTMLElement;
      expect(document.activeElement).toBe(first);
    });
  });
});
