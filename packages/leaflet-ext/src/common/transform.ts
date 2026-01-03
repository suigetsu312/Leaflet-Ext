import type L from "leaflet";
import type { GeoLineString, GeoPoint, GeoPolygon } from "./geometry";

export function toLatLng(p: GeoPoint): L.LatLngExpression {
  return [p.lat, p.lng];
}

export function toPolylineLatLngs(ls: GeoLineString): L.LatLngExpression[] {
  return ls.points.map(toLatLng);
}

export function toPolygonLatLngs(pg: GeoPolygon): L.LatLngExpression[][] {
  return pg.rings.map((ring) => ring.map(toLatLng));
}
