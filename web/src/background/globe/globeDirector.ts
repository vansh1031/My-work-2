// Moves the globe camera. One method per thing the user does:
//   showFactory(f)  - fly to a factory: country, then state, then city (or a short slide if it is close by)
//   clearSelection() - zoom back out and resume the slow idle rotation
// A new call cancels any flight still running, so clicking quickly between factories never gets stuck.
import { Marker, type GeoJSONSource, type Map as MlMap, type PaddingOptions } from "maplibre-gl";
import { planFlight, type FactorySummary, type PublicConfig } from "@fa/shared";
import { bbox, findCountry, findState, type GeoCollection } from "./geoData";

type Geo = { countries: GeoCollection; states: GeoCollection };
type Anim = PublicConfig["animation"]["globe"];

export interface DirectorEvents {
  onMoving(moving: boolean): void;
  onStage(info: Record<string, unknown>): void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class GlobeDirector {
  private flightId = 0;
  private current: FactorySummary | null = null;
  private marker: Marker | null = null;
  private rotateRaf = 0;
  private lastFrame = 0;

  constructor(
    private map: MlMap,
    private geo: Geo,
    private anim: Anim,
    private reduceMotion: boolean,
    private events: DirectorEvents,
  ) {}

  destroy() {
    this.flightId++;
    cancelAnimationFrame(this.rotateRaf);
    this.marker?.remove();
  }

  setFactories(factories: FactorySummary[], selectedId: number | null) {
    const src = this.map.getSource("fa-factories") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: factories
        .filter((f) => f.id !== selectedId)
        .map((f) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.longitude, f.latitude] }, properties: { id: f.id } })),
    });
  }

  /** Space covered by the cards panel, so the camera centres the factory in the part of the screen you can see. */
  private padding(): PaddingOptions {
    const panel = document.querySelector(".side-panel")?.getBoundingClientRect();
    const pad = { top: 40, bottom: 40, left: 40, right: 40 };
    if (!panel) return pad;
    if (panel.right < window.innerWidth * 0.65) pad.left = panel.right + 24;
    else pad.bottom = Math.max(40, window.innerHeight - panel.top + 24);
    return pad;
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

  private highlight(f: FactorySummary) {
    const country = findCountry(this.geo, f.country);
    const state = findState(this.geo, f.state, country?.properties.iso ?? null);
    const src = this.map.getSource("fa-highlight") as GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: state ? [state as never] : [] });
    return { country, state };
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

    if (opts.instant || this.reduceMotion) {
      this.highlight(f);
      this.placeMarker(f);
      this.map.jumpTo({ center: city, zoom: a.cityZoom, padding });
      this.events.onStage({ flight: "instant", factory: f.name });
      return;
    }

    this.events.onMoving(true);
    try {
      if (kind === "slide" && previous) {
        // Close by: glide the camera and the pin together.
        this.events.onStage({ flight: "slide", factory: f.name });
        this.highlight(f);
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
        await this.move(() => this.map.easeTo({ center: city, zoom: a.cityZoom, duration: a.slideDurationMs, padding, easing: easeInOut, essential: true }), id);
        return;
      }

      // Far away, or the first selection: zoom out and turn to the country, then the state, then the city.
      this.marker?.remove();
      this.marker = null;
      const src = this.map.getSource("fa-highlight") as GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features: [] });
      const country = findCountry(this.geo, f.country);
      const state = findState(this.geo, f.state, country?.properties.iso ?? null);

      this.events.onStage({ flight: kind, stage: "country", factory: f.name, countryFound: Boolean(country), stateFound: Boolean(state) });
      const countryCam = country ? this.cameraFor(bbox(country.geometry), a.countryZoom, a.overviewZoom) : { center: city, zoom: a.countryZoom };
      if (!(await this.move(() => this.map.flyTo({ ...countryCam, duration: a.longFlightDurationMs, curve: 1.6, padding, essential: true }), id))) return;

      if (state) {
        this.events.onStage({ flight: kind, stage: "state", factory: f.name });
        this.highlight(f);
        const stateCam = this.cameraFor(bbox(state.geometry), a.stateZoom, countryCam.zoom);
        if (!(await this.move(() => this.map.easeTo({ ...stateCam, duration: a.stageDurationMs, padding, easing: easeInOut, essential: true }), id))) return;
      }

      this.events.onStage({ flight: kind, stage: "city", factory: f.name });
      this.placeMarker(f);
      await this.move(() => this.map.easeTo({ center: city, zoom: a.cityZoom, duration: a.stageDurationMs, padding, easing: easeInOut, essential: true }), id);
    } finally {
      if (id === this.flightId) {
        this.events.onMoving(false);
        this.events.onStage({ flight: kind, stage: "arrived", factory: f.name });
      }
    }
  }

  async clearSelection() {
    const id = ++this.flightId;
    this.current = null;
    this.marker?.remove();
    this.marker = null;
    (this.map.getSource("fa-highlight") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] });
    this.events.onMoving(false);
    this.events.onStage({ flight: "none", stage: "idle" });
    if (this.map.getZoom() > this.anim.overviewZoom + 0.1 && !this.reduceMotion) {
      if (!(await this.move(() => this.map.easeTo({ zoom: this.anim.overviewZoom, duration: 1200, padding: this.padding(), essential: true }), id))) return;
    } else {
      this.map.jumpTo({ zoom: this.anim.overviewZoom });
    }
    if (id === this.flightId) this.startRotation();
  }

  startRotation() {
    if (this.reduceMotion || this.anim.idleRotationDegreesPerSecond <= 0) return;
    cancelAnimationFrame(this.rotateRaf);
    this.lastFrame = performance.now();
    const spin = (now: number) => {
      const dt = (now - this.lastFrame) / 1000;
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
