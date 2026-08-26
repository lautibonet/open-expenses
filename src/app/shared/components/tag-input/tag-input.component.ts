import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

const BLUR_DELAY_MS = 150;

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule],
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.scss',
})
export class TagInputComponent {
  tags = input<string[]>([]);
  suggestions = input<string[]>([]);
  tagsChange = output<string[]>();

  inputValue = signal('');
  showDropdown = signal(false);
  highlightedIndex = signal(-1);

  inputRef = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  filteredSuggestions = computed(() => {
    const input = this.inputValue().toLowerCase();
    const selected = new Set(this.tags());
    return this.suggestions()
      .filter(s => !selected.has(s) && s.toLowerCase().includes(input))
      .slice(0, 10);
  });

  onInput(value: string): void {
    const trimmed = value.trim();
    if (trimmed.endsWith(',') || trimmed.endsWith(';')) {
      const tagText = trimmed.slice(0, -1).trim();
      if (tagText) {
        this.addTag(tagText);
      }
      return;
    }
    this.inputValue.set(value);
    this.highlightedIndex.set(-1);
    this.showDropdown.set(value.length > 0 && this.filteredSuggestions().length > 0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const suggestions = this.filteredSuggestions();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.update(i => Math.min(i + 1, suggestions.length - 1));
      this.showDropdown.set(suggestions.length > 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.update(i => Math.max(i - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedIndex() >= 0 && this.highlightedIndex() < suggestions.length) {
        this.addTag(suggestions[this.highlightedIndex()]);
      } else if (this.inputValue().trim()) {
        this.addTag(this.inputValue().trim());
      }
    } else if (event.key === 'Escape') {
      this.showDropdown.set(false);
      this.highlightedIndex.set(-1);
    } else if (event.key === 'Backspace' && !this.inputValue()) {
      this.removeLastTag();
    }
  }

  addTag(tag: string): void {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !this.tags().includes(normalized)) {
      this.tagsChange.emit([...this.tags(), normalized]);
    }
    this.inputValue.set('');
    this.showDropdown.set(false);
    this.highlightedIndex.set(-1);
    this.inputRef()?.nativeElement?.focus();
  }

  removeTag(tag: string): void {
    this.tagsChange.emit(this.tags().filter(t => t !== tag));
  }

  removeLastTag(): void {
    const current = this.tags();
    if (current.length > 0) {
      this.tagsChange.emit(current.slice(0, -1));
    }
  }

  selectSuggestion(suggestion: string): void {
    this.addTag(suggestion);
  }

  onBlur(): void {
    setTimeout(() => {
      this.showDropdown.set(false);
      this.highlightedIndex.set(-1);
    }, BLUR_DELAY_MS);
  }
}
