import { describe, expect, it } from "vitest";
import { categoryMeta, designCategoryCards, getDesignSlotStyle } from "../designSlots.js";

const pickI18n = (value, locale) => (
  typeof value === "string" ? value : value?.[locale] || value?.en || ""
);

describe("design slot cards", () => {
  it("turns sample slots into detail-linkable cards", () => {
    const category = categoryMeta("earrings");
    const cards = designCategoryCards([], category, "en", pickI18n);

    expect(cards).toHaveLength(category.target);
    expect(cards.every((card) => card.href?.startsWith("/designs/"))).toBe(true);
    expect(cards.every((card) => card.ctaHref?.startsWith("/custom/new"))).toBe(true);
    expect(cards[0].mediaItems.length).toBeGreaterThan(1);
    expect(cards[0].media).toEqual(cards[0].mediaItems[0]);
  });

  it("keeps uploaded style media as a gallery for catalog cards", () => {
    const category = categoryMeta("ring");
    const cards = designCategoryCards([
      {
        id: "RING-900",
        category: "ring",
        subcategory: "engagementRing",
        coverImage: "/assets/fallback.png",
        media: [
          { kind: "image", src: "/uploads/front.webp" },
          { kind: "video", src: "/uploads/spin.mp4" },
        ],
        name: { en: "Gallery Ring" },
        leadDays: 10,
      },
    ], category, "en", pickI18n, { fillSlots: false });

    expect(cards).toHaveLength(1);
    expect(cards[0].mediaItems).toEqual([
      { kind: "image", src: "/uploads/front.webp" },
      { kind: "video", src: "/uploads/spin.mp4" },
      { kind: "image", src: "/assets/fallback.png" },
      { kind: "image", src: "/assets/lineup-ring.png" },
      { kind: "image", src: "/assets/lineup-band.png" },
    ]);
    expect(cards[0].media).toEqual({ kind: "image", src: "/uploads/front.webp" });
  });

  it("resolves a sample slot into a published detail style", () => {
    const style = getDesignSlotStyle("earrings-slot-2");

    expect(style).toMatchObject({
      id: "earrings-slot-2",
      category: "earrings",
      published: true,
      availableForSale: true,
    });
    expect(style.name.en).toBe("Halo Studs");
    expect(style.media).toHaveLength(1);
  });
});
