export class OfflineError extends Error {
  constructor() {
    super('OFFLINE');
    this.name = 'OfflineError';
  }
}
