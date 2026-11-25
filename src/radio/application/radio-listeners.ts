export interface RadioListener {
  readonly open: boolean;
  send(frame: object): void;
}

export class RadioListeners {
  private readonly byStation = new Map<string, Set<RadioListener>>();
  private readonly stationOf = new Map<RadioListener, string>();

  tuneIn(listener: RadioListener, stationId: string): void {
    this.tuneOut(listener);
    this.stationOf.set(listener, stationId);
    this.byStation.set(stationId, (this.byStation.get(stationId) ?? new Set()).add(listener));
  }

  tuneOut(listener: RadioListener): void {
    const stationId = this.stationOf.get(listener);
    if (stationId === undefined) return;
    this.stationOf.delete(listener);
    const listeners = this.byStation.get(stationId);
    listeners?.delete(listener);
    if (!listeners?.size) this.byStation.delete(stationId);
  }

  of(stationId: string): RadioListener[] {
    return [...(this.byStation.get(stationId) ?? [])];
  }

  count(stationId: string): number {
    return this.byStation.get(stationId)?.size ?? 0;
  }

  drop(stationId: string): RadioListener[] {
    const listeners = this.of(stationId);
    for (const listener of listeners) this.stationOf.delete(listener);
    this.byStation.delete(stationId);
    return listeners;
  }
}
