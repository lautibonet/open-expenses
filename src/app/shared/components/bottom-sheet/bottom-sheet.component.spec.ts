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
    <app-bottom-sheet label="Capture form">
      <div class="projected">Projected</div>
    </app-bottom-sheet>
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
});
