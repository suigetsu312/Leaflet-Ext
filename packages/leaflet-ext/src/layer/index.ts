import L from "leaflet";
import type { GeoFeature, GeoPoint } from "../common/geometry";
import { toLatLng } from "../common/transform";
import type { UIPanel } from "../control/HostControl";

export type LayerId = string;

export interface ILayer {
  id: LayerId;
  title?: string;
  pane?: string;
  visible: boolean;

  readonly leaflet: L.Layer;

  mount(map: L.Map): void;
  unmount(map: L.Map): void;
  setVisible(map: L.Map, v: boolean): void;

  // Optional replay hooks
  apply?(delta: unknown): void;
  clear?(): void;

  // Optional UI panels
  getPanels?(): UIPanel[];
}

export abstract class BaseLayer implements ILayer {
  abstract id: LayerId;
  title?: string;
  pane?: string;
  visible = true;

  abstract readonly leaflet: L.Layer;

  mount(map: L.Map) {
    if (this.visible) this.leaflet.addTo(map);
  }

  unmount(map: L.Map) {
    map.removeLayer(this.leaflet);
  }

  setVisible(map: L.Map, v: boolean) {
    this.visible = v;
    if (v) this.leaflet.addTo(map);
    else map.removeLayer(this.leaflet);
  }

  getPanels?(): UIPanel[];
}

/** Marker wrapper (OOP). Domain markers can extend this to add styling/extra state. */
export interface IMarker {
  id: string;
  readonly leaflet: L.Marker | L.CircleMarker;
  setPosition(p: GeoPoint): void;
}

export abstract class BaseMarker implements IMarker {
  id: string;
  abstract readonly leaflet: L.Marker | L.CircleMarker;

  constructor(id: string) {
    this.id = id;
  }

  setPosition(p: GeoPoint) {
    (this.leaflet as any).setLatLng(toLatLng(p));
  }
}

export type MarkerDelta<P extends Record<string, unknown> = Record<string, unknown>> =
  | { type: "upsert"; feature: GeoFeature<P> } // feature.geometry should be GeoPoint
  | { type: "remove"; id: string }
  | { type: "clear" };

/**
 * MarkerLayer: a BaseLayer specialization that manages a set of markers by ID.
 * Domain layers (e.g. vessel layer) should extend this and implement create/update.
 */
export abstract class MarkerLayer<
  M extends IMarker,
  P extends Record<string, unknown> = Record<string, unknown>
> extends BaseLayer {
  readonly leaflet = L.layerGroup();

  private markers = new Map<string, M>();

  constructor(
    public id: string,
    opts?: { title?: string; pane?: string; visible?: boolean }
  ) {
    super();
    this.title = opts?.title ?? this.id;
    this.pane = opts?.pane;
    this.visible = opts?.visible ?? true;
  }

  protected abstract createMarker(feature: GeoFeature<P>): M;

  protected updateMarker(marker: M, feature: GeoFeature<P>) {
    // default only moves for point geometry
    const g = feature.geometry as any;
    if (g && typeof g.lat === "number" && typeof g.lng === "number") {
      marker.setPosition({ lat: g.lat, lng: g.lng });
    }
  }

  getMarker(id: string): M | undefined {
    return this.markers.get(id);
  }

  apply(delta: unknown) {
    const d = delta as MarkerDelta<P>;
    if (!d || typeof d !== "object") return;

    if (d.type === "clear") {
      this.clear();
      return;
    }

    if (d.type === "remove") {
      const m = this.markers.get(d.id);
      if (!m) return;
      this.leaflet.removeLayer(m.leaflet);
      this.markers.delete(d.id);
      return;
    }

    if (d.type === "upsert") {
      const f = d.feature;
      let m = this.markers.get(f.id);
      if (!m) {
        m = this.createMarker(f);
        this.markers.set(f.id, m);
        this.leaflet.addLayer(m.leaflet);
      }
      this.updateMarker(m, f);
    }
  }

  clear() {
    this.leaflet.clearLayers();
    this.markers.clear();
  }
}
