import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appFitText]',
})
export class FitTextDirective implements OnInit, OnDestroy {
  readonly minSizeRem = input(0.75, { alias: 'appFitTextMinSizeRem' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private raf = 0;
  private lastWidth = 0;

  ngOnInit(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      /* Only width changes from outside are interesting: the fitting itself
         changes the host's height, and reacting to that would loop forever. */
      if (Math.abs(width - this.lastWidth) < 0.5) return;
      this.lastWidth = width;
      this.schedule();
    });
    this.resizeObserver.observe(this.host.nativeElement);

    this.mutationObserver = new MutationObserver(() => this.schedule());
    this.mutationObserver.observe(this.host.nativeElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    this.schedule();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.fit());
  }

  private fit(): void {
    const el = this.host.nativeElement;
    el.style.fontSize = '';
    if (el.scrollWidth <= el.clientWidth) return;

    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const minPx = this.minSizeRem() * rootSize;
    let size = parseFloat(getComputedStyle(el).fontSize) || minPx;
    while (size > minPx) {
      size = Math.max(minPx, size - 1);
      el.style.fontSize = `${size}px`;
      if (el.scrollWidth <= el.clientWidth) return;
    }
  }
}
