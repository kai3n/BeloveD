import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../../i18n.jsx";
import { LuxurySelect, listboxNavigationIndex } from "../../components/ui.jsx";
import GalleryStep from "../../components/intake/GalleryStep.jsx";
import { ImageOptionGrid, MetalSwatches, ShapeTiles } from "../../components/intake/pickers.jsx";
import { confirmationScrollBehavior } from "../../pages/IntakeForm.jsx";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => "en"),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

describe("intake custom listbox accessibility", () => {
  it("LuxurySelect gives the trigger/listbox a name and makes the actual controls options", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <LuxurySelect
          value="6"
          ariaLabel="Ring size"
          options={[{ value: "6", label: "US 6" }, { value: "7", label: "US 7" }]}
          onChange={() => {}}
        />
      </LocaleProvider>,
    );

    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-label="Ring size"');
    expect(html).toContain('role="listbox"');
    expect(html).toMatch(/<li role="none"><div[^>]*><button[^>]*role="option"[^>]*aria-selected="true"/);
  });

  it("intake tile listboxes expose localized names and one roving tab stop", () => {
    const imageHtml = renderToStaticMarkup(
      <ImageOptionGrid
        ariaLabel="Choose a piece"
        value="ring"
        options={[{ value: "ring", label: "Ring" }, { value: "necklace", label: "Necklace" }]}
        onSelect={() => {}}
      />,
    );
    const shapeHtml = renderToStaticMarkup(<ShapeTiles ariaLabel="Choose a shape" value="round" onSelect={() => {}} />);
    const metalHtml = renderToStaticMarkup(<MetalSwatches ariaLabel="Choose a metal" value="18kw" onSelect={() => {}} />);

    expect(imageHtml).toContain('role="listbox" aria-label="Choose a piece"');
    expect(shapeHtml).toContain('role="listbox" aria-label="Choose a shape"');
    expect(metalHtml).toContain('role="listbox" aria-label="Choose a metal"');
    expect((imageHtml.match(/tabindex="0"/g) || [])).toHaveLength(1);
    expect((shapeHtml.match(/tabindex="0"/g) || [])).toHaveLength(1);
    expect((metalHtml.match(/tabindex="0"/g) || [])).toHaveLength(1);
  });

  it("supports arrows plus Home/End navigation without hijacking unrelated keys", () => {
    expect(listboxNavigationIndex("ArrowDown", 1, 5)).toBe(2);
    expect(listboxNavigationIndex("ArrowUp", 0, 5)).toBe(4);
    expect(listboxNavigationIndex("ArrowRight", 4, 5)).toBe(0);
    expect(listboxNavigationIndex("Home", 3, 5)).toBe(0);
    expect(listboxNavigationIndex("End", 1, 5)).toBe(4);
    expect(listboxNavigationIndex("Tab", 1, 5)).toBeNull();
  });
});

describe("intake step announcements", () => {
  it("renders a named region with a programmatic heading focus target", () => {
    const html = renderToStaticMarkup(
      <GalleryStep index={1} total={3} title="Choose a metal" kicker="02 — Piece">
        <button type="button">Platinum</button>
      </GalleryStep>,
    );
    expect(html).toMatch(/<section[^>]*aria-labelledby="[^"]+"[^>]*>/);
    expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Choose a metal<\/h2>/);
  });

  it("disables completion scroll animation when reduced motion is requested", () => {
    expect(confirmationScrollBehavior(() => ({ matches: true }))).toBe("auto");
    expect(confirmationScrollBehavior(() => ({ matches: false }))).toBe("smooth");
  });
});
