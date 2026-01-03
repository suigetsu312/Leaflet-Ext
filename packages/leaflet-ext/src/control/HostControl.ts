import L from "leaflet";
import type { MapHost } from "../host/mapHost";

export type UIButton = {
  kind: "button";
  id: string;
  label: string;
  onClick: () => void;
  enabled?: () => boolean;
};

export type UIToggle = {
  kind: "toggle";
  id: string;
  label: string;
  get: () => boolean;
  set: (v: boolean) => void;
};

export type UISlider = {
  kind: "slider";
  id: string;
  label?: string;
  min: number;
  max: number;
  step?: number;
  get: () => number;
  set: (v: number) => void;
  format?: (v: number) => string;
};

export type UIControl = UIButton | UIToggle | UISlider;

export type UIPanel = {
  id: string;
  title?: string;
  controls: UIControl[];
};

/**
 * A Leaflet Control that renders panels into DOM.
 * This is deliberately framework-agnostic (no React/Vue dependency).
 */
export class UIPanelControl extends L.Control {
  private host: MapHost;
  private root?: HTMLDivElement;

  private scheduled = false;
  private interacting = false;

  // cache: controlId -> elements
  private btnEl = new Map<string, HTMLButtonElement>();
  private toggleEl = new Map<string, HTMLInputElement>();
  private sliderEl = new Map<string, HTMLInputElement>();
  private sliderValueEl = new Map<string, HTMLSpanElement>();

  // cache: panelId -> container
  private panelEl = new Map<string, HTMLDivElement>();

  constructor(host: MapHost, opts: { position?: L.ControlPosition } = {}) {
    super({ position: opts.position ?? "topright" });
    this.host = host;
  }

  isInteracting() { return this.interacting; }

  onAdd() {
    const root = L.DomUtil.create("div", "") as HTMLDivElement;
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "10px";
    root.style.minWidth = "240px";

    // stop propagation (critical)
    const stop = (e: Event) => L.DomEvent.stopPropagation(e);
    L.DomEvent.disableClickPropagation(root);
    L.DomEvent.disableScrollPropagation(root);
    L.DomEvent.on(root, "pointerdown", stop);
    L.DomEvent.on(root, "mousedown", stop);
    L.DomEvent.on(root, "touchstart", stop);
    L.DomEvent.on(root, "dblclick", stop);

    // interaction lock (so we don't fight user dragging slider)
    root.addEventListener("pointerdown", () => (this.interacting = true), true);
    window.addEventListener("pointerup", () => (this.interacting = false), true);
    window.addEventListener("pointercancel", () => (this.interacting = false), true);

    this.root = root;

    // Build once
    this.build();

    // Patch once
    this.patch();

    return root;
  }

  onRemove() {
    this.root = undefined;
    this.btnEl.clear();
    this.toggleEl.clear();
    this.sliderEl.clear();
    this.sliderValueEl.clear();
    this.panelEl.clear();
  }

  requestRender() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      // structure might change (panels added/removed) -> rebuild if needed
      this.reconcile();
      this.patch();
    });
  }

  /** Ensure DOM structure matches current panels (add missing panels/controls) */
  private reconcile() {
    if (!this.root) return;
    const panels = this.host.collectPanels();

    // Add missing panels (simple: we never delete in prototype)
    for (const p of panels) {
      if (!this.panelEl.has(p.id)) {
        const card = this.createPanelCard(p.id, p.title);
        this.root.appendChild(card);
        this.panelEl.set(p.id, card);

        const list = card.querySelector("[data-role=list]") as HTMLDivElement;
        for (const c of p.controls) {
          list.appendChild(this.createControlNode(c));
        }
      }
    }
  }

  private build() {
    if (!this.root) return;
    const panels = this.host.collectPanels();
    for (const p of panels) {
      const card = this.createPanelCard(p.id, p.title);
      this.root.appendChild(card);
      this.panelEl.set(p.id, card);

      const list = card.querySelector("[data-role=list]") as HTMLDivElement;
      for (const c of p.controls) {
        list.appendChild(this.createControlNode(c));
      }
    }
  }

  private createPanelCard(id: string, title?: string) {
    const card = document.createElement("div");
    card.dataset.panelId = id;
    card.style.padding = "10px";
    card.style.borderRadius = "10px";
    card.style.background = "rgba(255,255,255,0.92)";
    card.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";

    if (title) {
      const h = document.createElement("div");
      h.textContent = title;
      h.style.fontWeight = "700";
      h.style.marginBottom = "8px";
      card.appendChild(h);
    }

    const list = document.createElement("div");
    list.dataset.role = "list";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    card.appendChild(list);

    return card;
  }

  private createControlNode(c: UIControl): HTMLElement {
    if (c.kind === "button") {
      const btn = document.createElement("button");
      btn.textContent = c.label;
      btn.onclick = () => {
        c.onClick();
        this.requestRender();
      };
      this.btnEl.set(c.id, btn);
      return btn;
    }

    if (c.kind === "toggle") {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.cursor = "pointer";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.onchange = () => {
        c.set(cb.checked);
        this.requestRender();
      };
      this.toggleEl.set(c.id, cb);

      const text = document.createElement("span");
      text.textContent = c.label;

      row.appendChild(cb);
      row.appendChild(text);
      return row;
    }

    // slider
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.gap = "8px";

    const label = document.createElement("span");
    label.textContent = c.label ?? c.id;

    const value = document.createElement("span");
    value.style.fontFamily = "monospace";

    top.appendChild(label);
    top.appendChild(value);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(c.min);
    slider.max = String(c.max);
    slider.step = String(c.step ?? 1);
    slider.oninput = () => {
      const v = Number(slider.value);
      c.set(v);
      value.textContent = c.format ? c.format(v) : String(Math.floor(v));
    };

    this.sliderEl.set(c.id, slider);
    this.sliderValueEl.set(c.id, value);

    wrap.appendChild(top);
    wrap.appendChild(slider);
    return wrap;
  }

  /** Patch values only (fast) */
  private patch() {
    const panels = this.host.collectPanels();

    for (const p of panels) {
      for (const c of p.controls) {
        if (c.kind === "button") {
          const btn = this.btnEl.get(c.id);
          if (!btn) continue;
          btn.textContent = c.label;
          btn.disabled = c.enabled ? !c.enabled() : false;
          continue;
        }

        if (c.kind === "toggle") {
          const cb = this.toggleEl.get(c.id);
          if (!cb) continue;
          cb.checked = c.get();
          continue;
        }

        if (c.kind === "slider") {
          const slider = this.sliderEl.get(c.id);
          const value = this.sliderValueEl.get(c.id);
          if (!slider || !value) continue;

          const v = c.get();
          // user is dragging -> don't override slider thumb
          if (!this.interacting) slider.value = String(v);
          value.textContent = c.format ? c.format(v) : String(Math.floor(v));
        }
      }
    }
  }
}
