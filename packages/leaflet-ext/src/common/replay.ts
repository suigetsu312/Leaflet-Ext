import type { MapHost } from "../host/mapHost";

export type ReplayEvent = { layerId: string; delta: unknown };

export interface ReplayDataSource {
  poll(fromMs: number, toMs: number): ReplayEvent[];
  snapshot?(tMs: number): ReplayEvent[];
}

type TimeListener = (tMs: number) => void;
type TickListener = (fromMs: number, toMs: number) => void;

export class ReplayClock {
  private playing = false;
  private speed = 1;
  private tMs = 0;
  private lastWall = 0;

  private timeListeners = new Set<TimeListener>();
  private tickListeners = new Set<TickListener>();

  isPlaying() { return this.playing; }
  getTime() { return this.tMs; }
  getSpeed() { return this.speed; }   // ✅ 新增

  setSpeed(x: number) {
    if (!Number.isFinite(x) || x <= 0) return;
    this.speed = x;
  }

  seek(tMs: number) {
    const next = Math.max(0, tMs);
    const prev = this.tMs;
    this.tMs = next;
    for (const cb of this.tickListeners) cb(prev, next);
    for (const cb of this.timeListeners) cb(this.tMs);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastWall = performance.now();
    requestAnimationFrame(this.loop);
    for (const cb of this.timeListeners) cb(this.tMs);
  }

  pause() {
    this.playing = false;
    for (const cb of this.timeListeners) cb(this.tMs);
  }

  onTime(cb: TimeListener) {
    this.timeListeners.add(cb);
    return () => this.timeListeners.delete(cb);
  }

  onTick(cb: TickListener) {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  private loop = (now: number) => {
    if (!this.playing) return;
    const dt = now - this.lastWall;
    this.lastWall = now;

    const prev = this.tMs;
    this.tMs = prev + dt * this.speed;

    for (const cb of this.tickListeners) cb(prev, this.tMs);
    for (const cb of this.timeListeners) cb(this.tMs);

    requestAnimationFrame(this.loop);
  };
}

export class ReplayDriver {
  private unsubs: Array<() => void> = [];

  constructor(
    private host: MapHost,
    private clock: ReplayClock,
    private source: ReplayDataSource
  ) {}

  start() {
    const unsub = this.clock.onTick((from, to) => {
      // Prototype rule: if seeking backwards, clear layers then snapshot (if available)
      if (to < from) {
        this.host.clearAllReplayCapableLayers();
        const snap = this.source.snapshot?.(to);
        if (snap) for (const e of snap) this.host.applyToLayer(e.layerId, e.delta);
        return;
      }

      const evs = this.source.poll(from, to);
      for (const e of evs) this.host.applyToLayer(e.layerId, e.delta);
    });

    this.unsubs.push(unsub);
  }

  stop() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
