import { describe, expect, it } from "vitest";
import { styleSeedData } from "../styleSeedData.js";

const productSignature = (src) => {
  const decoded = decodeURIComponent(String(src || ""));
  // 셀프호스팅 파일명은 제품 코드로 시작한다: /assets/designs/<CODE>-....jpg
  const productMatch = decoded.match(/\/assets\/designs\/([A-Za-z0-9]+)[-.]/);
  const code = productMatch?.[1] || "";
  const numericGroups = [...code.matchAll(/\d{3,}/g)].map((match) => match[0]);
  return numericGroups.sort((a, b) => b.length - a.length)[0] || code;
};

const expectedProductTitles = {
  "RING-001": "Four-Prong Solitaire Ring",
  "RING-002": "Cathedral Six-Prong Solitaire Ring",
  "RING-003": "Round Halo Engagement Ring",
  "RING-004": "Emerald Hidden Halo Engagement Ring",
  "RING-005": "Round Three-Stone Ring",
  "RING-006": "Cushion Double-Row Side-Stone Halo Ring",
  "RING-007": "Bold Bezel Solitaire Ring",
  "RING-009": "Low Four-Prong Solitaire Ring",
  "BAND-001": "Shared-Prong Diamond Eternity Band",
  "BAND-005": "French Pavé Wedding Band",
  "BAND-006": "Channel-Set Eternity Band",
  "EARR-001": "Round Diamond Stud Earrings",
  "EARR-002": "Inside-Out Hoop Earrings",
  "EARR-003": "Princess Halo Stud Earrings",
  "EARR-004": "Cushion Huggie Hoop Earrings",
  "EARR-005": "Emerald Halo Drop Earrings",
  "EARR-006": "Graduated Inside-Out Huggie Hoop Earrings",
  "BRAC-001": "Four-Prong Tennis Bracelet",
  "BRAC-002": "Shared-Prong Bangle Bracelet",
  "BRAC-003": "Beveled X Tennis Bracelet",
  "NECK-001": "Round Solitaire Pendant",
  "NECK-002": "Round Halo Pendant",
  "NECK-003": "Cluster Flower Pendant",
  "NECK-004": "Thirteen-Stone Demi Eternity Necklace",
  "NECK-005": "Round and Pear Diamond Drop Necklace",
  "NECK-006": "Marquise Pear Flower Pendant",
  "NECK-007": "Four-Prong Tennis Necklace",
  "NECK-008": "Station Necklace",
  "NECK-009": "Diamond Cross Pendant",
  "NECK-010": "Shield Diamond Cross Statement Pendant",
};

const normalizeStyleKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const duplicateGroups = (keyForStyle) => {
  const groups = new Map();
  styleSeedData.forEach((style) => {
    const key = keyForStyle(style);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(style.id);
  });
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
};

describe("style seed media", () => {
  it("only publishes styles with original product media", () => {
    expect(styleSeedData.length).toBeGreaterThan(0);

    const invalid = styleSeedData.filter((style) => {
      const media = Array.isArray(style.media) ? style.media : [];
      return media.length === 0
        || style.mediaComplete !== true
        || media.some((item) => !String(item.src || "").startsWith("/assets/designs/"));
    });

    expect(invalid).toEqual([]);
  });

  it("keeps each style carousel scoped to one product family", () => {
    const mismatched = styleSeedData.flatMap((style) => {
      const media = Array.isArray(style.media) ? style.media : [];
      const expected = productSignature(media[0]?.src);
      return media
        .filter((item) => productSignature(item.src) !== expected)
        .map((item) => ({
          styleId: style.id,
          expected,
          actual: productSignature(item.src),
        }));
    });

    expect(mismatched).toEqual([]);
  });

  it("limits every style carousel to five assets", () => {
    const overLimit = styleSeedData
      .filter((style) => (style.media || []).length > 5)
      .map((style) => ({ styleId: style.id, count: style.media.length }));

    expect(overLimit).toEqual([]);
  });

  it("uses product-matched titles for every seeded style", () => {
    const actualTitles = Object.fromEntries(styleSeedData.map((style) => [style.id, style.name.en]));

    expect(actualTitles).toEqual(expectedProductTitles);
  });

  it("does not publish duplicate style identities", () => {
    expect(duplicateGroups((style) => [
      style.category,
      style.subcategory,
      normalizeStyleKey(style.name?.en),
    ].join("|"))).toEqual([]);
  });

  it("does not publish the same supplier product twice", () => {
    expect(duplicateGroups((style) => normalizeStyleKey(style.supplierEvidence))).toEqual([]);
  });

  it("does not publish the same category product image twice", () => {
    expect(duplicateGroups((style) => {
      const signature = productSignature(style.coverImage || style.media?.[0]?.src);
      return signature ? [style.category, style.subcategory, signature].join("|") : "";
    })).toEqual([]);
  });

  it("keeps the cathedral six-prong style away from the old four-prong solitaire media", () => {
    const style = styleSeedData.find((item) => item.id === "RING-002");

    expect(style?.name.en).toBe("Cathedral Six-Prong Solitaire Ring");
    expect(style?.name.ko).toBe("캐시드럴 6프롱 솔리테어 링");
    expect(style?.supplierEvidence).toContain("cathedral-six-prong-solitaire-engagement-ring");
    expect(style?.coverImage).toContain("RIGTXR01745");
    expect(style?.coverImage).not.toContain("RIGTX06263R200");
  });
});
