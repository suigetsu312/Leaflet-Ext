import L from "leaflet";
import type { UIPanel } from "../control/HostControl";
import type { ILayer } from "../layer";

export type HostOptions = {
  zoomControl?: boolean;
  center?: [number, number];
  zoom?: number;
};

export class MapHost {
  readonly map: L.Map;
  private layers = new Map<string, ILayer>();
  private extraPanels: (() => UIPanel[])[] = [];

  constructor(container: HTMLElement, opts: HostOptions = {}) {
    this.map = L.map(container, { zoomControl: opts.zoomControl ?? true });

    const center = opts.center ?? [25.033, 121.5654];
    const zoom = opts.zoom ?? 12;
    this.map.setView(center, zoom);
  }

  addOsmBaseMap() {
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(this.map);
  }

  createPane(name: string, zIndex: number) {
    const pane = this.map.createPane(name);
    pane.style.zIndex = String(zIndex);
    return pane;
  }

  registerLayer(layer: ILayer, addNow = true) {
    if (this.layers.has(layer.id)) throw new Error(`Layer exists: ${layer.id}`);
    this.layers.set(layer.id, layer);
    if (addNow) layer.mount(this.map);
  }

  listLayers(): ILayer[] {
    return [...this.layers.values()];
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  setLayerVisible(id: string, v: boolean) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.setVisible(this.map, v);
  }

  toggleLayer(id: string) {
    const layer = this.layers.get(id);
    if (!layer) return;
    this.setLayerVisible(id, !layer.visible);
  }

  /** Called by ReplayDriver, etc. */
  applyToLayer(layerId: string, delta: unknown) {
    this.layers.get(layerId)?.apply?.(delta);
  }

  clearAllReplayCapableLayers() {
    for (const l of this.layers.values()) l.clear?.();
  }

  /** Panels provided by non-layer modules (e.g. replay controller) */
  registerPanelProvider(fn: () => UIPanel[]) {
    this.extraPanels.push(fn);
  }

  collectPanels(): UIPanel[] {
    const panels: UIPanel[] = [];

    // Global "Layers" panel
    panels.push({
      id: "layers",
      title: "Layers",
      controls: this.listLayers().map((l) => ({
        kind: "toggle" as const,
        id: `layer:${l.id}`,
        label: l.title ?? l.id,
        get: () => l.visible,
        set: (v: boolean) => this.setLayerVisible(l.id, v)
      }))
    });

    // Layer-specific panels
    for (const l of this.layers.values()) {
      const lp = l.getPanels?.();
      if (lp?.length) panels.push(...lp);
    }

    // Extra panels
    for (const fn of this.extraPanels) panels.push(...fn());

    return panels;
  }

  invalidateSizeSoon() {
    requestAnimationFrame(() => this.map.invalidateSize());
  }

  dispose() {
    this.map.remove();
    this.layers.clear();
    this.extraPanels = [];
  }
}
