"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

const WIEN = { lng: 16.3738, lat: 48.2082 };

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
const MAP_STYLE_ID = process.env.NEXT_PUBLIC_MAP_STYLE ?? "dataviz-light";
/** Nach MapTiler-Publish hochzählen, damit Browser/CDN nicht die alte style.json cachen */
const MAP_STYLE_V = process.env.NEXT_PUBLIC_MAP_STYLE_V ?? "1";

/** Welt-Polygon — Loch = Wien (dunkler Filter überall außer Wien) */
const MASK_OUTER: [number, number][] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

function mapTilerStyleUrl(styleId: string, key: string) {
  const params = new URLSearchParams({
    key,
    // Cache-Bust nach Publish; in Dev zusätzlich Timestamp
    v: `${MAP_STYLE_V}-${typeof window !== "undefined" ? Math.floor(Date.now() / 60_000) : MAP_STYLE_V}`,
  });
  return `https://api.maptiler.com/maps/${styleId}/style.json?${params.toString()}`;
}

const OSM_FALLBACK = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [
    {
      id: "bg",
      type: "background" as const,
      paint: { "background-color": "#d7dbe0" },
    },
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      paint: { "raster-saturation": -0.5, "raster-opacity": 1 },
    },
  ],
};

type LngLat = [number, number];

/** Gebäude erst ab diesem Zoom (App-Fallback, falls Style kein minzoom setzt) */
const BUILDINGS_MIN_ZOOM = 14;

type StyleLayer = {
  id: string;
  "source-layer"?: string;
  type?: string;
};

type MapInstance = {
  remove: () => void;
  addControl: (...args: unknown[]) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  once: (event: string, cb: (...args: unknown[]) => void) => void;
  resize: () => void;
  setStyle?: (style: string | object) => void;
  addSource: (id: string, source: object) => void;
  addLayer: (layer: object) => void;
  getSource: (id: string) => unknown;
  getLayer: (id: string) => unknown;
  getStyle: () => { layers?: StyleLayer[] };
  setLayerZoomRange: (layerId: string, minzoom: number, maxzoom: number) => void;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
  jumpTo: (options: {
    center?: [number, number] | { lng: number; lat: number };
    zoom?: number;
    bearing?: number;
    pitch?: number;
  }) => void;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  stop: () => void;
};

function ringSignedArea(ring: LngLat[]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

/** GeoJSON: Außenring gegen Uhrzeigersinn, Loch mit Uhrzeigersinn */
function ensureHoleWinding(ring: LngLat[]): LngLat[] {
  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];
  if (ringSignedArea(closed) > 0) {
    return [...closed].reverse();
  }
  return closed;
}

async function loadWienMaskGeoJSON() {
  const res = await fetch("/geo/wien-boundary.geojson");
  if (!res.ok) throw new Error(`Wien-Grenze HTTP ${res.status}`);
  const fc = (await res.json()) as {
    features: Array<{ geometry: { type: string; coordinates: LngLat[][] } }>;
  };
  const geom = fc.features[0]?.geometry;
  if (!geom || geom.type !== "Polygon") {
    throw new Error("Wien-Grenze: erwartetes Polygon fehlt");
  }
  const hole = ensureHoleWinding(geom.coordinates[0] as LngLat[]);

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Polygon" as const,
          coordinates: [MASK_OUTER, hole],
        },
      },
      {
        type: "Feature" as const,
        properties: { kind: "outline" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [geom.coordinates[0]],
        },
      },
    ],
  };
}

function isBuildingLayer(layer: StyleLayer) {
  const id = layer.id.toLowerCase();
  const sourceLayer = (layer["source-layer"] ?? "").toLowerCase();
  return (
    id.includes("building") ||
    sourceLayer === "building" ||
    sourceLayer === "building_ext"
  );
}

function deferBuildingLayers(map: MapInstance) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (!isBuildingLayer(layer)) continue;
    try {
      map.setLayerZoomRange(layer.id, BUILDINGS_MIN_ZOOM, 24);
    } catch (err) {
      console.warn("Building-Zoom für Layer fehlgeschlagen:", layer.id, err);
    }
  }
}

/** Tiles für max. Pitch/Rotate vorwärmen, damit Rechtsklick weniger nachlädt */
function warmCameraTileCache(
  map: MapInstance,
  container: HTMLElement,
) {
  return new Promise<void>((resolve) => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const home = {
      center: [center.lng, center.lat] as [number, number],
      zoom,
      bearing: 0,
      pitch: 0,
    };

    const prevVisibility = container.style.visibility;
    container.style.visibility = "hidden";

    const steps: Array<{ bearing: number; pitch: number }> = [
      { bearing: 0, pitch: 60 },
      { bearing: 90, pitch: 60 },
      { bearing: 180, pitch: 60 },
      { bearing: 270, pitch: 60 },
    ];

    let i = 0;
    const finish = () => {
      container.style.visibility = prevVisibility;
      resolve();
    };

    const run = () => {
      if (i >= steps.length) {
        map.jumpTo(home);
        map.once("idle", finish);
        return;
      }
      const step = steps[i++];
      map.jumpTo({
        center: home.center,
        zoom: home.zoom,
        bearing: step.bearing,
        pitch: step.pitch,
      });
      map.once("idle", () => run());
    };

    run();
  });
}

function applyWienFocusMask(map: MapInstance, geojson: object) {
  if (!map.getSource("wien-focus")) {
    map.addSource("wien-focus", { type: "geojson", data: geojson });
  }

  if (!map.getLayer("wien-outside-mask")) {
    map.addLayer({
      id: "wien-outside-mask",
      type: "fill",
      source: "wien-focus",
      filter: ["!", ["has", "kind"]],
      paint: {
        "fill-color": "#3a424c",
        "fill-opacity": 0.88,
      },
    });
  } else {
    map.setPaintProperty("wien-outside-mask", "fill-color", "#3a424c");
    map.setPaintProperty("wien-outside-mask", "fill-opacity", 0.88);
  }

  if (!map.getLayer("wien-outline-halo")) {
    map.addLayer({
      id: "wien-outline-halo",
      type: "line",
      source: "wien-focus",
      filter: ["==", ["get", "kind"], "outline"],
      paint: {
        "line-color": "#ffffff",
        "line-width": 6,
        "line-opacity": 0.55,
        "line-blur": 1.2,
      },
    });
  } else {
    map.setPaintProperty("wien-outline-halo", "line-width", 6);
    map.setPaintProperty("wien-outline-halo", "line-opacity", 0.55);
  }

  if (!map.getLayer("wien-outline")) {
    map.addLayer({
      id: "wien-outline",
      type: "line",
      source: "wien-focus",
      filter: ["==", ["get", "kind"], "outline"],
      paint: {
        "line-color": "#3a424c",
        "line-width": 2.25,
        "line-opacity": 0.9,
      },
    });
  } else {
    map.setPaintProperty("wien-outline", "line-color", "#3a424c");
    map.setPaintProperty("wien-outline", "line-width", 2.25);
    map.setPaintProperty("wien-outline", "line-opacity", 0.9);
  }
}

export default function ViennaMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let onResize: (() => void) | null = null;
    let fellBack = false;

    const uiTimer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 5000);

    (async () => {
      const mod = await import("maplibre-gl");
      const MapCtor = mod.Map;
      const AttributionControl = mod.AttributionControl;
      const setWorkerUrl = mod.setWorkerUrl;

      if (!MapCtor || !setWorkerUrl) {
        throw new Error("MapLibre Map/setWorkerUrl nicht gefunden");
      }

      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      if (cancelled || !containerRef.current) return;

      const hasKey = Boolean(MAPTILER_KEY);
      let style: string | typeof OSM_FALLBACK = hasKey
        ? mapTilerStyleUrl(MAP_STYLE_ID, MAPTILER_KEY)
        : OSM_FALLBACK;

      setSourceLabel(
        hasKey ? `MapTiler ${MAP_STYLE_ID}` : "OSM-Fallback (kein Key)",
      );

      if (hasKey && typeof style === "string") {
        try {
          const probe = await fetch(style);
          if (!probe.ok) {
            throw new Error(`MapTiler Style HTTP ${probe.status}`);
          }
        } catch (err) {
          console.warn("MapTiler Style nicht ladbar:", err);
          setError(
            "MapTiler-Style nicht erreichbar (Key/Referrer/Style-ID?). OSM-Fallback aktiv.",
          );
          fellBack = true;
          setSourceLabel("OSM-Fallback");
          style = OSM_FALLBACK;
        }
      }

      if (cancelled || !containerRef.current) return;

      let maskGeo: object | null = null;
      try {
        maskGeo = await loadWienMaskGeoJSON();
      } catch (err) {
        console.warn("Wien-Maske nicht ladbar:", err);
      }

      const map = new MapCtor({
        container: containerRef.current,
        style,
        center: [WIEN.lng, WIEN.lat],
        zoom: 11.2,
        bearing: 0,
        minZoom: 9,
        maxZoom: 18,
        maxBounds: [
          [15.95, 47.95],
          [16.85, 48.48],
        ],
        renderWorldCopies: false,
        attributionControl: false,
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        maxPitch: 60,
        // Weniger sichtbares Nachladen / Crossfade beim Drehen
        fadeDuration: 0,
        maxTileCacheSize: 500,
      }) as MapInstance;

      if (AttributionControl) {
        map.addControl(
          new AttributionControl({ compact: true }),
          "bottom-right",
        );
      }

      onResize = () => map.resize();

      const afterStyleReady = () => {
        if (cancelled) return;
        deferBuildingLayers(map);
        if (!maskGeo) return;
        try {
          applyWienFocusMask(map, maskGeo);
        } catch (err) {
          console.warn("Wien-Maske konnte nicht gelegt werden:", err);
        }
      };

      map.on("load", () => {
        if (cancelled) return;
        afterStyleReady();
        onResize?.();
        clearTimeout(uiTimer);

        map.once("idle", () => {
          if (cancelled || !containerRef.current) {
            setReady(true);
            return;
          }
          void warmCameraTileCache(map, containerRef.current)
            .catch((err) => {
              console.warn("Tile-Warmup fehlgeschlagen:", err);
            })
            .finally(() => {
              if (!cancelled) setReady(true);
            });
        });
      });

      map.on("style.load", () => {
        afterStyleReady();
      });

      map.on("error", (e: unknown) => {
        const msg = String(
          (e as { error?: { message?: string } })?.error?.message ?? "",
        );
        if (!msg || fellBack) return;
        console.warn("Map error", msg);
        if (map.setStyle && !fellBack) {
          fellBack = true;
          setSourceLabel("OSM-Fallback");
          setError("MapTiler-Tiles fehlgeschlagen — Fallback OSM.");
          map.setStyle(OSM_FALLBACK);
        }
      });

      window.addEventListener("resize", onResize);
      requestAnimationFrame(() => onResize?.());
      setTimeout(() => onResize?.(), 100);
      setTimeout(() => onResize?.(), 400);
      mapRef.current = map;
    })().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(uiTimer);
      if (onResize) window.removeEventListener("resize", onResize);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="hero-map-wrap">
      {!ready && !error && <p className="map-status">Karte wird geladen…</p>}
      {error && <p className="map-status map-status-error">{error}</p>}
      <div
        ref={containerRef}
        className="hero-map"
        role="img"
        aria-label="Karte von Wien"
      />
      <p className="map-debug">{sourceLabel}</p>
    </div>
  );
}
