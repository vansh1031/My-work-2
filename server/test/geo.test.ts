import { describe, expect, it } from "vitest";
import { distanceKm, planFlight } from "@fa/shared";

const indore = { latitude: 22.7196, longitude: 75.8577 };
const pithampur = { latitude: 22.6139, longitude: 75.6797 };
const stuttgart = { latitude: 48.7758, longitude: 9.1829 };

describe("globe flight planning", () => {
  it("measures distance in km", () => {
    expect(distanceKm(indore, pithampur)).toBeGreaterThan(15);
    expect(distanceKm(indore, pithampur)).toBeLessThan(30);
    expect(distanceKm(indore, stuttgart)).toBeGreaterThan(6200);
    expect(distanceKm(indore, stuttgart)).toBeLessThan(6600);
  });

  it("first selection does the full sequence", () => {
    expect(planFlight(null, indore, 600)).toBe("first");
  });

  it("nearby factory slides, far factory does the long flight", () => {
    expect(planFlight(indore, pithampur, 600)).toBe("slide");
    expect(planFlight(indore, stuttgart, 600)).toBe("long");
  });
});
