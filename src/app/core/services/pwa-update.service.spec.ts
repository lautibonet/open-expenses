import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { PwaUpdateService, UPDATE_POLL_INTERVAL_MS } from './pwa-update.service';

const SIX_HOURS = 6 * 60 * 60 * 1000;

describe('PwaUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let activateUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  function createService({ enabled = true }: { enabled?: boolean } = {}) {
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject<UnrecoverableStateEvent>();
    checkForUpdate = vi.fn(async () => true);
    activateUpdate = vi.fn(async () => true);
    reload = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: enabled,
            versionUpdates,
            unrecoverable,
            checkForUpdate,
            activateUpdate,
          },
        },
        { provide: DOCUMENT, useValue: { defaultView: { location: { reload } } } },
      ],
    });
    return TestBed.inject(PwaUpdateService);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signals the prompt only when a downloaded version is ready', () => {
    const service = createService();
    expect(service.updateReady()).toBe(false);

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    expect(service.updateReady()).toBe(false);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.updateReady()).toBe(true);
  });

  it('does not signal the prompt for non-ready version events', () => {
    const service = createService();

    versionUpdates.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });
    versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new' },
      error: 'boom',
    });

    expect(service.updateReady()).toBe(false);
  });

  it('reloads immediately when the worker reports an unrecoverable state', () => {
    const service = createService();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'broken cache' });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads onto the new version when the user confirms', async () => {
    const service = createService();

    await service.applyUpdate();

    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads even if activation fails, so the user is never stranded', async () => {
    activateUpdate = vi.fn(async () => {
      throw new Error('activation failed');
    });
    const service = createService();

    await service.applyUpdate();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('asks the worker to check for updates on the six-hour cadence', async () => {
    vi.useFakeTimers();
    createService();

    await vi.advanceTimersByTimeAsync(SIX_HOURS - 1);
    expect(checkForUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('never polls or prompts when the service worker is unavailable', () => {
    vi.useFakeTimers();
    const service = createService({ enabled: false });

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    vi.advanceTimersByTime(SIX_HOURS);

    expect(service.updateReady()).toBe(false);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('hides the prompt when the user defers it', () => {
    const service = createService();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.updateReady()).toBe(true);

    service.dismiss();

    expect(service.updateReady()).toBe(false);
  });
});
