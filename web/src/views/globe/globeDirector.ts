// Moves the globe camera. One method per thing the user does:
//   showFactory(f)   - fly to a factory: country, then state, then city (or a short slide if it is close by)
//   clearSelection() - zoom back out and resume the slow idle rotation
// A new call cancels any flight still running, so clicking quickly between factories never gets stuck.
// The globe is a normal panel: people may drag and zoom it; that stops the idle rotation.
import { Marker, type GeoJSONSource, type Map as MlMap, type MapLayerMouseEvent, type PaddingOptions } from "maplibre-gl";
import { planFlight, type FactorySummary, type PublicConfig } from "@fa/shared";
import { bbox, findCountry, findState, loadStates, type GeoCollection } from "./geoData";
import type { FeatureCollection } from "./geojson";

type AnyCollection = FeatureCollection<unknown, unknown>;

type Anim = PublicConfig["animation"]["globe"];

export interface DirectorEvents {
  onStage(info: Record<string, unknown>): void;
  /** A factory pin on the globe was clicked. */
  onPick(factoryId: number): void;
}

const EMPTY: AnyCollection = { type: "FeatureCollection", features: [] };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** After someone drags or zooms the globe, wait this long before the idle rotation starts again. */
const RESUME_ROTATION_MS = 30_000;

export class GlobeDirector {
  private flightId = 0;
  private current: FactorySummary | null = null;
  private marker: Marker | null = null;
  private rotateRaf = 0;
  private lastFrame = 0;
  private resumeTimer = 0;
  // What the overlay layers show.
  private factoryData: AnyCollection = EMPTY;
  private statesData: AnyCollection = EMPTY;
  private highlightData: AnyCollection = EMPTY;
  private readonly onVisibility = () => (document.hidden ? this.stopRotation() : this.maybeRotate());

  constructor(
    private map: MlMap,
    private countries: GeoCollection,
    private anim: Anim,
    private reduceMotion: boolean,
    private events: DirectorEvents,
    /** Closest zoom for a city. The built-in globe has no streets, so it stops nearer the state level. */
    private cityZoom: number,
    /** Space to keep clear at the panel edges (for example under the selected factory card). */
    private padding: () => PaddingOptions,
  ) {
    document.addEventListener("visibilitychange", this.onVisibility);
    // Someone dragging or zooming takes over from the automatic movement.
    for (const event of ["dragstart", "zoomstart", "rotatestart"] as const) {
      map.on(event, (e: { originalEvent?: unknown }) => {
        if (!e.originalEvent) return;
        this.flightId++;
        this.stopRotation();
        window.clearTimeout(this.resumeTimer);
        this.resumeTimer = window.setTimeout(() => this.maybeRotate(), RESUME_ROTATION_MS);
      });
    }
    map.on("click", "fa-factories", (e: MapLayerMouseEvent) => {
      const id = Number(e.features?.[0]?.properties?.id);
      if (id) this.events.onPick(id);
    });
    map.on("mouseenter", "fa-factories", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "fa-factories", () => (map.getCanvas().style.cursor = ""));
  }

  destroy() {
    this.flightId++;
    this.stopRotation();
    window.clearTimeout(this.resumeTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.marker?.remove();
  }

  private setSource(id: string, data: AnyCollection) {
    (this.map.getSource(id) as GeoJSONSource | undefined)?.setData(data as never);
  }

  setFactories(factories: FactorySummary[], selectedId: number | null) {
    this.factoryData = {
      type: "FeatureCollection",
      features: factories
        .filter((f) => f.id !== selectedId)
        .map((f) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.longitude, f.latitude] }, properties: { id: f.id } })),
    };
    this.setSource("fa-factories", this.factoryData);
  }

  private setStates(states: GeoCollection | null, highlight: GeoCollection["features"][number] | null) {
    this.statesData = (states ?? EMPTY) as AnyCollection;
    this.highlightData = { type: "FeatureCollection", features: highlight ? [highlight as never] : [] };
    this.setSource("fa-states", this.statesData);
    this.setSource("fa-highlight", this.highlightData);
  }

  private move(run: () => void, id: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.map.once("moveend", () => resolve(id === this.flightId));
      run();
    });
  }

  private placeMarker(f: FactorySummary, lngLat: [number, number] = [f.longitude, f.latitude]) {
    if (!this.marker) {
      const el = document.createElement("div");
      el.className = "globe-marker";
      el.innerHTML = '<span class="ring"></span><span class="dot"></span><span class="label"></span>';
      this.marker = new Marker({ element: el }).setLngLat(lngLat).addTo(this.map);
    }
    this.marker.setLngLat(lngLat);
    (this.marker.getElement().querySelector(".label") as HTMLElement).textContent = f.city;
  }

  /** The factory's country, its states, and the state to highlight. States are loaded only for this country. */
  private async areas(f: FactorySummary) {
    const country = findCountry(this.countries, f.country) ?? null;
    const states = country ? await loadStates(country.properties.iso) : null;
    const state = states ? (findState(states, f.state) ?? null) : null;
    return { country, states, state };
  }

  private cameraFor(b: [number, number, number, number], maxZoom: number, minZoom: number) {
    // Zoom is worked out for the visible area (padding); the centre is the area's own centre, because
    // flyTo and easeTo apply the same padding again when they move there.
    const cam = this.map.cameraForBounds(b, { padding: this.padding() });
    const zoom = Math.min(maxZoom, Math.max(minZoom, cam?.zoom ?? maxZoom));
    const center: [number, number] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    return { center, zoom };
  }

  async showFactory(f: FactorySummary, opts: { instant?: boolean } = {}) {
    const id = ++this.flightId;
    this.stopRotation();
    this.map.stop();
    const a = this.anim;
    const previous = this.current;
    this.current = f;
    const city: [number, number] = [f.longitude, f.latitude];
    const padding = this.padding();
    const kind = planFlight(previous, f, a.nearDistanceKm);
    const areas = this.areas(f); // starts loading the states now, while the camera is already moving

    if (opts.instant || this.reduceMotion) {
      const { states, state } = await areas;
      if (id !== this.flightId) return;
      this.setStates(states, state);
      this.placeMarker(f);
      this.map.jumpTo({ center: city, zoom: this.cityZoom, padding });
      this.events.onStage({ flight: "instant", factory: f.name });
      return;
    }

    try {
      if (kind === "slide" && previous) {
        // Close by: glide the camera and the pin together.
        this.events.onStage({ flight: "slide", factory: f.name });
        void areas.then(({ states, state }) => id === this.flightId && this.setStates(states, state));
        const from: [number, number] = [previous.longitude, previous.latitude];
        const start = performance.now();
        const step = (now: number) => {
          if (id !== this.flightId) return;
          const t = Math.min(1, (now - start) / a.slideDurationMs);
          const k = easeInOut(t);
          this.placeMarker(f, [from[0] + (city[0] - from[0]) * k, from[1] + (city[1] - from[1]) * k]);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        await this.move(() => this.map.easeTo({ center: city, zoom: this.cityZoom, duration: a.slideDurationMs, padding, easing: easeInOut, essential: true }), id);
        return;
      }

      // Far away, or the first selection: zoom out and turn to the country, then the state, then the city.
      this.marker?.remove();
      this.marker = null;
      this.setStates(null, null);
      const country = findCountry(this.countries, f.country);
      this.events.onStage({ flight: kind, stage: "country", factory: f.name, countryFound: Boolean(country) });
      const countryCam = country ? this.cameraFor(bbox(country.geometry), a.countryZoom, a.overviewZoom) : { center: city, zoom: a.countryZoom };
      if (!(await this.move(() => this.map.flyTo({ ...countryCam, duration: a.longFlightDurationMs, curve: 1.6, padding, essential: true }), id))) return;

      const { states, state } = await areas;
      if (id !== this.flightId) return;
      this.setStates(states, state);
      if (state) {
        this.events.onStage({ flight: kind, stage: "state", factory: f.name });
        const stateCam = this.cameraFor(bbox(state.geometry), a.stateZoom, countryCam.zoom);
        if (!(await this.move(() => this.map.easeTo({ ...stateCam, duration: a.stageDurationMs, padding, easing: easeInOut, essential: true }), id))) return;
      }

      this.events.onStage({ flight: kind, stage: "city", factory: f.name, stateFound: Boolean(state) });
      this.placeMarker(f);
      await this.move(() => this.map.easeTo({ center: city, zoom: this.cityZoom, duration: a.stageDurationMs, padding, easing: easeInOut, essential: true }), id);
    } finally {
      if (id === this.flightId) this.events.onStage({ flight: kind, stage: "arrived", factory: f.name });
    }
  }

  async clearSelection() {
    const id = ++this.flightId;
    this.current = null;
    this.marker?.remove();
    this.marker = null;
    this.setStates(null, null);
    this.events.onStage({ flight: "none", stage: "idle" });
    if (this.map.getZoom() > this.anim.overviewZoom + 0.1 && !this.reduceMotion) {
      if (!(await this.move(() => this.map.easeTo({ zoom: this.anim.overviewZoom, duration: 1200, padding: this.padding(), essential: true }), id))) return;
    } else {
      this.map.jumpTo({ zoom: this.anim.overviewZoom, padding: this.padding() });
    }
    if (id === this.flightId) this.maybeRotate();
  }

  /** Slow spin, only when nothing is selected, the tab is visible, and motion is allowed. */
  maybeRotate() {
    if (this.current || this.reduceMotion || document.hidden || this.anim.idleRotationDegreesPerSecond <= 0) return;
    cancelAnimationFrame(this.rotateRaf);
    this.lastFrame = performance.now();
    const spin = (now: number) => {
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      const c = this.map.getCenter();
      this.map.setCenter([c.lng + this.anim.idleRotationDegreesPerSecond * dt, c.lat]);
      this.rotateRaf = requestAnimationFrame(spin);
    };
    this.rotateRaf = requestAnimationFrame(spin);
  }

  stopRotation() {
    cancelAnimationFrame(this.rotateRaf);
  }
}
