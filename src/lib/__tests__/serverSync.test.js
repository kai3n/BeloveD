import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  hydrateFromServer: vi.fn(),
}));

vi.mock("../api.js", () => ({
  apiFetch: mocks.apiFetch,
  ApiUnavailableError: class ApiUnavailableError extends Error {},
}));

vi.mock("../store.js", () => ({ hydrateFromServer: mocks.hydrateFromServer }));

beforeEach(() => {
  vi.resetModules();
  mocks.apiFetch.mockReset();
  mocks.hydrateFromServer.mockReset();
});

describe("public settings synchronization", () => {
  it("marks payment settings ready even when the independent design request fails", async () => {
    mocks.apiFetch.mockImplementation((path) => {
      if (path === "/designs") return Promise.reject(new Error("designs unavailable"));
      if (path === "/settings/public") {
        return Promise.resolve({ settings: { payment: { zelle: "current@example.com" } } });
      }
      throw new Error(`unexpected path ${path}`);
    });

    const { hasSyncedPublicSettings, syncCatalogFromServer } = await import("../serverSync.js");
    expect(hasSyncedPublicSettings()).toBe(false);
    await expect(syncCatalogFromServer()).resolves.toBe(true);
    expect(hasSyncedPublicSettings()).toBe(true);
    expect(mocks.hydrateFromServer).toHaveBeenCalledWith({
      styles: undefined,
      settings: { payment: { zelle: "current@example.com" } },
    });
  });
});
