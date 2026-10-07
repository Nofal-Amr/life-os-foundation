import { describe, expect, it } from "vitest";

import { poseFromOrientation, qiblaBearing, smoothHeading, turnTo } from "./qibla";

describe("qiblaBearing", () => {
  it("matches known directions", () => {
    // Cairo ≈ 136°, London ≈ 119°, New York ≈ 58°, Jakarta ≈ 295°.
    expect(qiblaBearing(30.0444, 31.2357)).toBeCloseTo(136.1, 0);
    expect(qiblaBearing(51.5074, -0.1278)).toBeCloseTo(119, 0);
    expect(qiblaBearing(40.7128, -74.006)).toBeCloseTo(58.5, 0);
    expect(qiblaBearing(-6.2088, 106.8456)).toBeCloseTo(295.1, 0);
  });
});

describe("poseFromOrientation", () => {
  it("reads a flat phone from its top edge", () => {
    // alpha counts anticlockwise: alpha 90 means the top points west.
    expect(poseFromOrientation(0, 0, 0)).toEqual({ heading: 0, hold: "flat" });
    expect(poseFromOrientation(90, 0, 0).heading).toBeCloseTo(270);
  });

  it("reads an upright phone from where its back faces", () => {
    // Held up facing north, then turned to face east.
    const north = poseFromOrientation(0, 90, 0);
    expect(north.hold).toBe("upright");
    expect(north.heading).toBeCloseTo(0);
    expect(poseFromOrientation(270, 90, 0).heading).toBeCloseTo(90);
  });
});

describe("turnTo and smoothing", () => {
  it("takes the short way round", () => {
    expect(turnTo(350, 10)).toBe(20);
    expect(turnTo(10, 350)).toBe(-20);
  });

  it("smooths across north without spinning", () => {
    const value = smoothHeading(355, 5, 0.5);
    expect(value).toBeCloseTo(0);
  });
});
