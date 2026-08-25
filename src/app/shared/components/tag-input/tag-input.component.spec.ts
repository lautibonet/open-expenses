import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagInputComponent } from './tag-input.component';

describe('TagInputComponent', () => {
  let component: TagInputComponent;
  let fixture: ComponentFixture<TagInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setInputs(tags: string[], suggestions: string[]): void {
    fixture.componentRef.setInput('tags', tags);
    fixture.componentRef.setInput('suggestions', suggestions);
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit tagsChange when adding a tag via Enter', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs([], []);

    component.inputValue.set('groceries');
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitSpy).toHaveBeenCalledWith(['groceries']);
  });

  it('should normalize tag to lowercase and trimmed', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs([], []);

    component.inputValue.set('  Groceries  ');
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitSpy).toHaveBeenCalledWith(['groceries']);
  });

  it('should not add duplicate tags', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs(['groceries'], []);

    component.inputValue.set('groceries');
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should add a tag from suggestion on Enter', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs([], ['food', 'groceries', 'weekly']);

    component.inputValue.set('food');
    component.highlightedIndex.set(0);

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitSpy).toHaveBeenCalledWith(['food']);
  });

  it('should remove a tag', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs(['food', 'weekly'], []);

    component.removeTag('food');

    expect(emitSpy).toHaveBeenCalledWith(['weekly']);
  });

  it('should remove last tag on Backspace when input is empty', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs(['food', 'weekly'], []);
    component.inputValue.set('');

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));

    expect(emitSpy).toHaveBeenCalledWith(['food']);
  });

  it('should not remove tag on Backspace when input has text', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs(['food', 'weekly'], []);
    component.inputValue.set('gro');

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should navigate suggestions with ArrowDown', () => {
    setInputs([], ['food', 'foodie']);
    component.inputValue.set('food');
    fixture.detectChanges();

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.highlightedIndex()).toBe(0);

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.highlightedIndex()).toBe(1);
  });

  it('should navigate suggestions with ArrowUp', () => {
    setInputs([], ['food', 'foodie']);
    component.inputValue.set('food');
    component.highlightedIndex.set(1);
    fixture.detectChanges();

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.highlightedIndex()).toBe(0);
  });

  it('should hide dropdown on Escape', () => {
    component.showDropdown.set(true);
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showDropdown()).toBe(false);
  });

  it('should filter suggestions by input value', () => {
    setInputs([], ['food', 'groceries', 'weekly']);

    component.onInput('food');

    expect(component.filteredSuggestions()).toEqual(['food']);
  });

  it('should exclude already-selected tags from suggestions', () => {
    setInputs(['food'], ['food', 'groceries', 'weekly']);

    component.onInput('');

    expect(component.filteredSuggestions()).toEqual(['groceries', 'weekly']);
  });

  it('should limit suggestions to 10', () => {
    setInputs([], Array.from({ length: 15 }, (_, i) => `tag${i}`));

    component.onInput('tag');

    expect(component.filteredSuggestions().length).toBe(10);
  });

  it('should select a suggestion on mousedown', () => {
    const emitSpy = vi.spyOn(component.tagsChange, 'emit');
    setInputs([], ['food', 'groceries']);

    component.selectSuggestion('food');

    expect(emitSpy).toHaveBeenCalledWith(['food']);
    expect(component.inputValue()).toBe('');
  });

  it('should show dropdown when input has text and matching suggestions exist', () => {
    setInputs([], ['food', 'groceries']);

    component.onInput('fo');

    expect(component.showDropdown()).toBe(true);
  });

  it('should not show dropdown when no matching suggestions', () => {
    setInputs([], ['food']);

    component.onInput('xyz');

    expect(component.showDropdown()).toBe(false);
  });
});
