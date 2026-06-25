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
