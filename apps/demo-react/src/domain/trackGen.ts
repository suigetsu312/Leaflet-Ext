// apps/demo-react/src/domain/trackGen.ts
export type Sample = { tMs: number; lat: number; lng: number; headingDeg: number };
export type VesselTrack = { id: string; samples: Sample[] };

const KNOT_TO_MPS = 0.514444;

function metersPerDegLat(latDeg: number) {
  return 111_320;
}
function metersPerDegLng(latDeg: number) {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

function generateStraightTrack(opts: {
  startLat: number;
  startLng: number;
  headingDeg: number;
  speedKn: number;
  hz?: number;       // default 10
  minutes?: number;  // default 10
}): Sample[] {
  const hz = opts.hz ?? 10;
  const minutes = opts.minutes ?? 10;

  const dtMs = 1000 / hz;
  const total = minutes * 60 * hz;

  const mps = opts.speedKn * KNOT_TO_MPS;

  const rad = (opts.headingDeg * Math.PI) / 180;
  const vEast = Math.cos(rad) * mps;   // 東向 m/s
  const vNorth = Math.sin(rad) * mps;  // 北向 m/s

  const mpdLat = metersPerDegLat(opts.startLat);
  const mpdLng = metersPerDegLng(opts.startLat);

  const out: Sample[] = [];
  for (let i = 0; i < total; i++) {
    const tSec = (i * dtMs) / 1000;
    const dEast = vEast * tSec;
    const dNorth = vNorth * tSec;

    out.push({
      tMs: i * dtMs,
      lat: opts.startLat + dNorth / mpdLat,
      lng: opts.startLng + dEast / mpdLng,
      headingDeg: opts.headingDeg
    });
  }
  return out;
}

/**
 * 5 vessels in an "umbrella" fan.
 * - all move forward at same speed
 * - headings fan out around baseHeading
 * - start positions are slightly offset sideways so they don't overlap
 */
export function generateUmbrellaFan5(opts: {
  originLat: number;
  originLng: number;
  baseHeadingDeg: number; // center direction
  speedKn: number;        // 10 kn
  minutes?: number;       // 10
  hz?: number;            // 10
  lateralSpacingM?: number; // default 80m
}): VesselTrack[] {
  const headings = [-40, -20, 0, 20, 40].map((d) => d + opts.baseHeadingDeg);
  const spacing = opts.lateralSpacingM ?? 80;

  // Lateral offsets relative to base heading: left..right
  const lateralOffsets = [-2, -1, 0, 1, 2].map((k) => k * spacing);

  const mpdLat = metersPerDegLat(opts.originLat);
  const mpdLng = metersPerDegLng(opts.originLat);

  const baseRad = (opts.baseHeadingDeg * Math.PI) / 180;
  // "right" unit vector (east,north) perpendicular to forward direction
  const rightEast = -Math.sin(baseRad);
  const rightNorth = Math.cos(baseRad);

  const tracks: VesselTrack[] = [];

  for (let i = 0; i < 5; i++) {
    const off = lateralOffsets[i];
    const dEast = rightEast * off;
    const dNorth = rightNorth * off;

    const startLat = opts.originLat + dNorth / mpdLat;
    const startLng = opts.originLng + dEast / mpdLng;

    tracks.push({
      id: `v${i}`,
      samples: generateStraightTrack({
        startLat,
        startLng,
        headingDeg: headings[i],
        speedKn: opts.speedKn,
        hz: opts.hz,
        minutes: opts.minutes
      })
    });
  }

  return tracks;
}
