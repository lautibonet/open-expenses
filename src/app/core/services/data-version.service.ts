import { Injectable, effect, signal, untracked } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataVersionService {
  readonly version = signal(0);

  bump(): void {
    this.version.update((n) => n + 1);
  }

  reloadOnChange(load: () => Promise<void>): void {
    let mountedVersion = this.version();
    effect(() => {
      const version = this.version();
      if (version !== mountedVersion) {
        mountedVersion = version;
        untracked(() => void load());
      }
    });
  }
}
