export type GeoPoint = { lat: number; lng: number };

export type GeoLineString = {
  type: "LineString";
  points: GeoPoint[];
};

export type GeoPolygon = {
  type: "Polygon";
  rings: GeoPoint[][]; // [outer, ...holes]
};

export type GeoGeometry = GeoPoint | GeoLineString | GeoPolygon;

export type GeoFeature<P extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  geometry: GeoGeometry;
  properties?: P;
};
