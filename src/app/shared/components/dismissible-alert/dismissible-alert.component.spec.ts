import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DismissibleAlertComponent } from './dismissible-alert.component';
import { LanguageService } from '../../../core/services/language.service';

describe('DismissibleAlertComponent', () => {
  let fixture: ComponentFixture<DismissibleAlertComponent>;
  let component: DismissibleAlertComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DismissibleAlertComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DismissibleAlertComponent);
    component = fixture.componentInstance;
  });

  it('renders the message with a close button', () => {
    fixture.componentRef.setInput('message', 'Something went wrong');
    fixture.componentRef.setInput('variant', 'error');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Something went wrong');

    const dismiss = alert.querySelector('.alert-dismiss') as HTMLButtonElement;
    expect(dismiss).not.toBeNull();
    expect(dismiss.getAttribute('aria-label')).toBe('Close');
    expect(dismiss.querySelector('svg')).not.toBeNull();
    expect(dismiss.textContent!.trim()).toBe('');
  });

  it('renders nothing when the message is empty', () => {
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();
  });

  it('hides itself when the close button is clicked', () => {
    fixture.componentRef.setInput('message', 'Saved');
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.alert-dismiss',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();
  });

  it('reappears when a new occurrence of the message arrives', () => {
    fixture.componentRef.setInput('message', 'First failure');
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.alert-dismiss',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();

    fixture.componentRef.setInput('message', 'Second failure');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).not.toBeNull();
  });

  it('reappears when the reset key changes even if the message is identical', () => {
    fixture.componentRef.setInput('message', 'Conversion failed');
    fixture.componentRef.setInput('resetKey', 1);
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.alert-dismiss',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();

    fixture.componentRef.setInput('resetKey', 2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).not.toBeNull();
  });

  it('stays hidden when neither the message nor the reset key changes', () => {
    fixture.componentRef.setInput('message', 'Conversion failed');
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.alert-dismiss',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();
  });

  it('applies the strip variant classes by default', () => {
    fixture.componentRef.setInput('message', 'Saved');
    fixture.componentRef.setInput('variant', 'success');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert.classList.contains('alert-strip-success')).toBe(true);
  });

  it('applies the note appearance classes when requested', () => {
    fixture.componentRef.setInput('message', 'Name required');
    fixture.componentRef.setInput('variant', 'error');
    fixture.componentRef.setInput('appearance', 'note');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert.classList.contains('alert-note-error')).toBe(true);
  });

  it('uses the active language for the close label', () => {
    TestBed.inject(LanguageService).activeLanguage.set('es');
    fixture.componentRef.setInput('message', 'Something went wrong');
    fixture.detectChanges();

    const dismiss = fixture.nativeElement.querySelector(
      '.alert-dismiss',
    ) as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('Cerrar');
  });
});
