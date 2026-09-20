import { describe, expect, it } from "vitest";
import {
  createSpecId,
  formatUtcTimestamp,
  isValidSpecId,
  isValidUtcTimestamp,
  normalizeSlug,
} from "#ids.ts";

describe("Maestro spec IDs", () => {
  it("formats an instant in UTC to second precision", () => {
    const instant = Temporal.Instant.from("2026-03-21T14:30:52.987Z");

    expect(formatUtcTimestamp(instant)).toBe("20260321-143052");
  });

  it("uses UTC rather than the local time zone", () => {
    const instant = Temporal.Instant.from("2026-03-21T00:30:52+02:00");

    expect(formatUtcTimestamp(instant)).toBe("20260320-223052");
  });

  it("normalizes title punctuation, whitespace, case, and accents", () => {
    expect(normalizeSlug("  Add Café: weather_alerts!  ")).toBe(
      "add-cafe-weather-alerts",
    );
    expect(normalizeSlug("Already---a_slug")).toBe("already-a-slug");
  });

  it("rejects a title without a slug character", () => {
    expect(() => normalizeSlug("--- !!!")).toThrow(
      "Spec slug must contain at least one letter or number.",
    );
  });

  it("composes deterministic IDs that sort by UTC timestamp", () => {
    const earlier = createSpecId({
      title: "Earlier change",
      instant: Temporal.Instant.from("2026-03-21T14:30:51Z"),
    });
    const later = createSpecId({
      title: "Later change",
      instant: Temporal.Instant.from("2026-03-21T14:30:52Z"),
    });

    expect(earlier).toBe("20260321-143051-earlier-change");
    expect(later).toBe("20260321-143052-later-change");
    expect(earlier < later).toBe(true);
  });

  it("validates the complete timestamp and slug format", () => {
    expect(isValidUtcTimestamp("20260229-235959")).toBe(false);
    expect(isValidUtcTimestamp("20240229-235959")).toBe(true);
    expect(isValidSpecId("20260321-143052-add-weather-alerts")).toBe(true);
    expect(isValidSpecId("20260321-143052-Add-weather-alerts")).toBe(false);
    expect(isValidSpecId("20260321-246052-add-weather-alerts")).toBe(false);
    expect(isValidSpecId("20260321-143052-")).toBe(false);
  });

});
