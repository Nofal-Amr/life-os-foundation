import { describe, expect, it } from "vitest";

import { checkPlace, distanceMeters, parsePlaceInput, type PlaceLike } from "./place";

const office: PlaceLike = {
  id: "office",
  name: "Office",
  latitude: 30.0444,
  longitude: 31.2357,
  radius_m: 50,
  kind: "office",
};
const site: PlaceLike = {
  id: "site",
  name: "Site",
  latitude: 30.0459,
  longitude: 31.2243,
  radius_m: 100,
  kind: "site",
};

/** A point `meters` north of the office. */
const north = (meters: number) => ({ latitude: 30.0444 + meters / 111_195, longitude: 31.2357 });

describe("place", () => {
  it("measures the distance between two points", () => {
    // Cairo Tower to Tahrir Square, about 1.1 km.
    const distance = distanceMeters(site, office);
    expect(distance).toBeGreaterThan(1080);
    expect(distance).toBeLessThan(1140);
  });

  it("inside when distance minus accuracy is within the radius", () => {
    const result = checkPlace({ ...north(70), accuracy: 30 }, [office, site]);
    expect(result.status).toBe("inside");
    expect(result.status === "inside" && result.place.id).toBe("office");
  });

  it("outside names the nearest place and distance", () => {
    const result = checkPlace({ ...north(300), accuracy: 10 }, [office, site]);
    expect(result.status).toBe("outside");
    if (result.status !== "outside") return;
    expect(result.nearest?.id).toBe("office");
    expect(Math.round(result.distance!)).toBe(300);
  });

  it("unclear above 100 m accuracy", () => {
    expect(checkPlace({ ...north(0), accuracy: 150 }, [office]).status).toBe("unclear");
  });

  it("parses coordinates and maps links", () => {
    expect(parsePlaceInput("30.0444, 31.2357")).toEqual({ latitude: 30.0444, longitude: 31.2357 });
    expect(parsePlaceInput("https://www.google.com/maps/@30.0444,31.2357,17z")).toEqual({
      latitude: 30.0444,
      longitude: 31.2357,
    });
    expect(parsePlaceInput("https://maps.google.com/?q=30.0444,31.2357")).toEqual({
      latitude: 30.0444,
      longitude: 31.2357,
    });
    expect(parsePlaceInput("the office")).toBeNull();
    expect(parsePlaceInput("95, 31")).toBeNull();
  });
});
