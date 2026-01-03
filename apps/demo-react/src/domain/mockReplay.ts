// apps/demo-react/src/domain/mockReplay.ts
import type { ReplayDataSource, ReplayEvent } from "@maplib/leaflet-ext";
import type { GeoFeature } from "@maplib/leaflet-ext";
import type { VesselProps } from "./vesselLayer";
import type { VesselTrack } from "./trackGen";

type TrackCursor = { id: string; samples: VesselTrack["samples"]; idx: number };

export class MockReplaySource implements ReplayDataSource {
  private cursors: TrackCursor[];

  constructor(
    private layerId: string,
    tracks: VesselTrack[]
  ) {
    this.cursors = tracks.map(t => ({ id: t.id, samples: t.samples, idx: 0 }));
  }

  /** poll like a server "since last time" within [fromMs,toMs] */
  poll(fromMs: number, toMs: number): ReplayEvent[] {
    // if seeking backward, driver will call snapshot; still keep safe here
    if (toMs < fromMs) return [];

    const evs: ReplayEvent[] = [];

    for (const c of this.cursors) {
      const s = c.samples;

      // advance idx to first sample > fromMs (so we don't resend)
      while (c.idx < s.length && s[c.idx].tMs <= fromMs) c.idx++;

      // emit samples <= toMs
      while (c.idx < s.length && s[c.idx].tMs <= toMs) {
        const p = s[c.idx];
        const feature: GeoFeature<VesselProps> = {
          id: c.id,
          geometry: { lat: p.lat, lng: p.lng },
          properties: { headingDeg: p.headingDeg, name: c.id }
        };

        evs.push({ layerId: this.layerId, delta: { type: "upsert", feature } });
        c.idx++;
      }
    }

    return evs;
  }

  /** snapshot at time tMs: emit latest sample <= tMs for each vessel, reset cursors */
  snapshot(tMs: number): ReplayEvent[] {
    const evs: ReplayEvent[] = [];

    for (const c of this.cursors) {
      const s = c.samples;

      // find last index <= tMs (linear is OK for 6000; binary if you want)
      let lastIdx = 0;
      while (lastIdx + 1 < s.length && s[lastIdx + 1].tMs <= tMs) lastIdx++;

      const p = s[lastIdx];
      const feature: GeoFeature<VesselProps> = {
        id: c.id,
        geometry: { lat: p.lat, lng: p.lng },
        properties: { headingDeg: p.headingDeg, name: c.id }
      };

      evs.push({ layerId: this.layerId, delta: { type: "upsert", feature } });

      // set cursor so next poll continues from here
      c.idx = lastIdx;
    }

    return evs;
  }
}
