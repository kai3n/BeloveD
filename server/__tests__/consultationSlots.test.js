import { describe, expect, it } from "vitest";
import { generateAvailableSlots, wallToUtc, isValidSlot } from "../consultationSlots.js";

const TZ = "America/Los_Angeles";
const hourOf = (iso) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso)).replace("24", "0"));
const weekdayOf = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(iso));

describe("consultation slots", () => {
  // 기준: 2026-07-10T00:00Z = 2026-07-09(목) 17:00 PDT
  const now = new Date("2026-07-10T00:00:00Z");

  it("wallToUtc: 여름 PT(PDT, UTC-7) 09:00 → 16:00 UTC", () => {
    expect(wallToUtc(2026, 6, 10, 9, 0, TZ).toISOString()).toBe("2026-07-10T16:00:00.000Z");
  });

  it("wallToUtc: 겨울 PT(PST, UTC-8) 09:00 → 17:00 UTC", () => {
    expect(wallToUtc(2026, 0, 15, 9, 0, TZ).toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("슬롯: 20분 간격·영업시간(09–17시)·일요일 제외·리드타임 이후", () => {
    const slots = generateAvailableSlots(now, new Set(), { tz: TZ, days: 14 });
    expect(slots.length).toBeGreaterThan(0);
    const minStart = now.getTime() + 2 * 3600 * 1000;
    expect(slots.every((s) => Date.parse(s) >= minStart)).toBe(true);
    expect(slots.every((s) => [0, 20, 40].includes(new Date(s).getUTCMinutes()))).toBe(true);
    expect(slots.some((s) => weekdayOf(s) === "Sun")).toBe(false);
    expect(slots.every((s) => hourOf(s) >= 9 && hourOf(s) < 18)).toBe(true);
  });

  it("예약된 슬롯은 제외", () => {
    const all = generateAvailableSlots(now, new Set(), { tz: TZ });
    const taken = all[5];
    const filtered = generateAvailableSlots(now, new Set([taken]), { tz: TZ });
    expect(all).toContain(taken);
    expect(filtered).not.toContain(taken);
    expect(filtered.length).toBe(all.length - 1);
  });

  it("isValidSlot: 생성 슬롯은 유효, 과거·비경계는 무효", () => {
    const all = generateAvailableSlots(now, new Set(), { tz: TZ });
    expect(isValidSlot(all[0], now, { tz: TZ })).toBe(true);
    expect(isValidSlot("2020-01-01T10:00:00.000Z", now, { tz: TZ })).toBe(false);
    expect(isValidSlot("2026-07-10T16:07:00.000Z", now, { tz: TZ })).toBe(false);
  });
});
