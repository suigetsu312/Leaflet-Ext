import { useEffect, useRef } from "react";
import {
  MapHost,
  UIPanelControl,
  ReplayClock,
  ReplayDriver
} from "@maplib/leaflet-ext";

import { VesselLayer } from "./domain/vesselLayer";
import { MockReplaySource } from "./domain/mockReplay";
import { generateUmbrellaFan5 } from "./domain/trackGen";

export default function App() {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    // 1) Host + base map
    const host = new MapHost(el, { center: [25.033, 121.5654], zoom: 12 });
    host.addOsmBaseMap();
    host.createPane("overlayHigh", 450);

    // 2) Domain layer (in app): vessels
    const vessels = new VesselLayer("vessels", {
      title: "Vessels",
      pane: "overlayHigh",
      visible: true
    });
    host.registerLayer(vessels, true);

    // 3) Generate 5 vessel tracks: umbrella fan, 10min @ 10Hz, speed 10kn
    const tracks = generateUmbrellaFan5({
      originLat: 25.033,
      originLng: 121.5654,
      baseHeadingDeg: 90,     // 90=往東；你要往北就 0
      speedKn: 10,
      minutes: 10,
      hz: 10,
      lateralSpacingM: 80
    });

    // 4) Replay: clock + driver + datasource
    const clock = new ReplayClock();
    const driver = new ReplayDriver(host, clock, new MockReplaySource("vessels", tracks));
    driver.start();

    // 5) UI panels
    host.registerPanelProvider(() => [
      {
        id: "replay",
        title: "Replay",
        controls: [
          {
            kind: "button",
            id: "replay:playpause",
            label: clock.isPlaying() ? "Pause" : "Play",
            onClick: () => {
              if (clock.isPlaying()) clock.pause();
              else clock.play();
              // 讓 UI 文字立即刷新
              panel.requestRender();
            }
          },
          {
            kind: "slider",
            id: "replay:speed",
            label: "Speed",
            min: 0.25,
            max: 4,
            step: 0.25,
            // prototype：不做 getSpeed，顯示用固定 1，但 set 會生效
            get: () => clock.getSpeed(),
            set: (v: number) => clock.setSpeed(v),
            format: (v: number) => `${v.toFixed(2)}x`
          },
          {
            kind: "slider",
            id: "replay:time",
            label: "Time",
            min: 0,
            max: 10 * 60 * 1000, // 10 minutes in ms
            step: 100,           // 10Hz=100ms 一筆
            get: () => clock.getTime(),
            set: (v: number) => clock.seek(v),
            format: (v: number) => `${(v / 1000).toFixed(1)}s`
          },
          {
            kind: "button",
            id: "replay:reset",
            label: "Reset",
            onClick: () => {
              clock.pause();
              clock.seek(0);
              panel.requestRender();
            }
          }
        ]
      }
    ]);

    // Leaflet control (UI renderer)
    const panel = new UIPanelControl(host, { position: "topright" });
    host.map.addControl(panel);

    // 6) While playing, update UI at low frequency (avoid DOM rebuild overload)
    let lastUi = 0;
    const UI_INTERVAL_MS = 120; // ~8fps enough
    const unsubTime = clock.onTime(() => {
      const now = performance.now();
      if (now - lastUi < UI_INTERVAL_MS) return;
      lastUi = now;
      panel.requestRender();
    });

    host.invalidateSizeSoon();

    // 7) cleanup
    return () => {
      unsubTime();
      driver.stop();
      clock.pause();
      host.dispose();
    };
  }, []);

  return <div ref={divRef} style={{ height: "100vh", width: "100vw" }} />;
}
