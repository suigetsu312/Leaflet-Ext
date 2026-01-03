// apps/demo-react/src/domain/vesselLayer.ts
import L from "leaflet";
import type { GeoFeature, GeoPoint } from "@maplib/leaflet-ext";
import { BaseMarker, MarkerLayer } from "@maplib/leaflet-ext";

export type VesselProps = {
  name?: string;
  headingDeg?: number;
};

function pentagonSvg(size = 22) {
  // 簡單好看的五邊形（mock 用足夠）
  const pts = "11,1 21,8 17,20 5,20 1,8";
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 22 22">
      <polygon points="${pts}" />
    </svg>
  `;
}

export class VesselMarker extends BaseMarker {
  readonly leaflet: L.Marker;
  private el: HTMLDivElement;

  constructor(id: string, pane?: string) {
    super(id);

    this.el = document.createElement("div");
    this.el.style.width = "22px";
    this.el.style.height = "22px";
    this.el.style.transformOrigin = "50% 50%";
    this.el.innerHTML = pentagonSvg(22);

    const poly = this.el.querySelector("polygon")!;
    poly.setAttribute("fill", "rgba(255, 80, 80, 0.9)");
    poly.setAttribute("stroke", "rgba(0,0,0,0.55)");
    poly.setAttribute("stroke-width", "1");

    const icon = L.divIcon({
      className: "",
      html: this.el,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    this.leaflet = L.marker([0, 0], { icon, pane });
  }

  setHeading(deg?: number) {
    if (deg == null) return;
    this.el.style.transform = `rotate(${deg}deg)`;
  }
}

export class VesselLayer extends MarkerLayer<VesselMarker, VesselProps> {
  protected createMarker(feature: GeoFeature<VesselProps>): VesselMarker {
    const m = new VesselMarker(feature.id, this.pane);
    return m;
  }

  protected override updateMarker(marker: VesselMarker, feature: GeoFeature<VesselProps>) {
    const p = feature.geometry as GeoPoint;
    marker.setPosition(p);
    marker.setHeading(feature.properties?.headingDeg);
  }
}
