import { describe, expect, it } from "vitest";
import { formatSuggestionLabel, parsePhotonSuggestions } from "./suggest";

function feature(props: Record<string, unknown>, coords: unknown[] = [-76.51, 39.24]) {
  return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: coords } };
}

const house = {
  countrycode: "US",
  housenumber: "123",
  street: "Main Street",
  locality: "Turner Station",
  city: "Dundalk",
  county: "Baltimore County",
  state: "Maryland",
  postcode: "21222",
};

describe("formatSuggestionLabel", () => {
  it("formats a house address as street, city/state, zip", () => {
    expect(formatSuggestionLabel(house)).toBe("123 Main Street, Dundalk, Maryland 21222");
  });

  it("leads with the POI name when present", () => {
    expect(
      formatSuggestionLabel({ name: "Johns Hopkins Hospital", street: "Orleans Street", city: "Baltimore", state: "Maryland" }),
    ).toBe("Johns Hopkins Hospital, Orleans Street, Baltimore, Maryland");
  });

  it("drops a name that duplicates the street line", () => {
    expect(formatSuggestionLabel({ name: "Main Street", street: "Main Street", city: "Dundalk", state: "Maryland" })).toBe(
      "Main Street, Dundalk, Maryland",
    );
  });

  it("falls back to district or county when city is missing", () => {
    expect(formatSuggestionLabel({ street: "Elm Road", county: "Baltimore County", state: "Maryland" })).toBe(
      "Elm Road, Baltimore County, Maryland",
    );
  });
});

describe("parsePhotonSuggestions", () => {
  it("parses a Photon FeatureCollection into labeled coordinates", () => {
    const out = parsePhotonSuggestions({ type: "FeatureCollection", features: [feature(house)] });
    expect(out).toEqual([{ label: "123 Main Street, Dundalk, Maryland 21222", lat: 39.24, lng: -76.51 }]);
  });

  it("filters out non-US results", () => {
    const ca = feature({ ...house, countrycode: "CA" });
    expect(parsePhotonSuggestions({ features: [ca] })).toEqual([]);
  });

  it("skips features with missing or non-numeric coordinates", () => {
    const bad1 = feature(house, []);
    const bad2 = feature(house, ["x", "y"]);
    expect(parsePhotonSuggestions({ features: [bad1, bad2] })).toEqual([]);
  });

  it("dedupes identical labels and respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      feature({ ...house, housenumber: String(i) }, [-76.5, 39.2]),
    );
    const out = parsePhotonSuggestions({ features: [feature(house), feature(house), ...many] }, 4);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((s) => s.label)).size).toBe(4);
  });

  it("returns [] for malformed payloads", () => {
    expect(parsePhotonSuggestions(null)).toEqual([]);
    expect(parsePhotonSuggestions({})).toEqual([]);
    expect(parsePhotonSuggestions({ features: "nope" })).toEqual([]);
  });
});
