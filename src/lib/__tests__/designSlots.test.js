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

  it("keeps uploaded style media as the complete gallery for catalog cards", () => {
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

  it("uses bracelet media for the bezel bracelet sample slot", () => {
    const category = categoryMeta("bangle");
    const existingStyles = [1, 2, 3].map((number) => ({
      id: `BRAC-00${number}`,
      category: "bangle",
      subcategory: "tennisBracelet",
      media: [{ kind: "image", src: `/uploads/bracelet-${number}.webp` }],
      name: { en: `Bracelet ${number}` },
      leadDays: 14,
    }));
    const cards = designCategoryCards(existingStyles, category, "en", pickI18n);
    const bezelSlot = cards.find((card) => card.title === "Bezel Bracelet");

    expect(bezelSlot?.media?.kind).toBe("image");
    // 과거 참조 파일(BCGTXBR07076)이 저장소에 없어 깨진 이미지가 노출됐다 → 실재 브레이슬릿 자산으로 교체
    expect(bezelSlot?.media?.src).toContain("/assets/designs/BCGTXBR01703");
  });
});
