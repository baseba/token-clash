// Who is tuned in to which station, in memory: a restart drops every listener, and their clients
// tune in again when they reconnect. Each listener hears one station at most.

/** Port: a client tuned in to a station. The realtime gateway wraps each WebSocket in one. */
export interface RadioListener {
  readonly open: boolean;
  /** Sends a frame as JSON. */
  send(frame: object): void;
}

export class RadioListeners {
  private readonly byStation = new Map<string, Set<RadioListener>>();
  private readonly stationOf = new Map<RadioListener, string>();

  /** Tunes in to a station, leaving the one it heard before. */
  tuneIn(listener: RadioListener, stationId: string): void {
    this.tuneOut(listener);
    this.stationOf.set(listener, stationId);
    this.byStation.set(stationId, (this.byStation.get(stationId) ?? new Set()).add(listener));
  }

  /** Stops listening, if it was. */
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

  /** Everyone stops listening to a station that closed. Returns who was listening. */
  drop(stationId: string): RadioListener[] {
    const listeners = this.of(stationId);
    for (const listener of listeners) this.stationOf.delete(listener);
    this.byStation.delete(stationId);
    return listeners;
  }
}
