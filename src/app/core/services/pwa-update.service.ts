import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { concatMap, from, interval } from 'rxjs';

/** The Angular service-worker docs' cadence for manual update checks. */
export const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * The app checks for a new version on open/refresh (worker registration) and on
 * every navigation request (the worker's built-in update check); this service
 * adds the docs' six-hour poll and drives the user-facing update flow.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);

  /** A new version is downloaded and waiting for a user-approved reload. */
  readonly updateReady = signal(false);

  constructor() {
    const swUpdate = this.swUpdate;
    if (!swUpdate?.isEnabled) return;

    swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
      }
    });

    swUpdate.unrecoverable.subscribe(() => {
      this.reload();
    });

    interval(UPDATE_POLL_INTERVAL_MS)
      .pipe(concatMap(() => from(swUpdate.checkForUpdate())))
      .subscribe();
  }

  /** Applies the downloaded update. Activation is only ever paired with a reload. */
  async applyUpdate(): Promise<void> {
    if (!this.swUpdate) return;

    try {
      await this.swUpdate.activateUpdate();
    } catch {
      // The downloaded version is already on disk; the reload applies it regardless.
    }
    this.reload();
  }

  dismiss(): void {
    this.updateReady.set(false);
  }

  private reload(): void {
    this.document.defaultView?.location.reload();
  }
}
