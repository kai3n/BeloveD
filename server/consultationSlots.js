// 화상 상담 20분 슬롯 생성 — 영업시간(월–토, PT 09:00–18:00) 기준으로 앞으로 N일치 슬롯을
// UTC ISO로 만들어 준다. 과거·리드타임·이미 예약된 슬롯은 제외. DST 안전(벽시계→UTC 변환).

export const SLOT_MINUTES = 20;
const TZ = process.env.CONSULTATION_TZ || "America/Los_Angeles";
const START_HOUR = 9;      // 09:00
const END_HOUR = 18;       // 마지막 슬롯 시작 17:40 (18:00 종료)
const DAYS = 14;
const LEAD_MS = 2 * 60 * 60 * 1000; // 최소 2시간 뒤부터 예약 가능

// 특정 타임존의 벽시계(y, monthIndex, day, hour, minute)를 UTC Date로 — DST 오프셋 반영.
// 2회 보정: 첫 추정 시각의 오프셋으로 근사한 뒤, 그 시각에서 오프셋을 다시 구해 확정한다.
// (1회 보정은 DST 봄 전환일 09:00 슬롯이 +1h 밀려 중복 슬롯을 만드는 버그가 있었다.)
export function wallToUtc(y, mo, d, h, mi, tz = TZ) {
  const targetWall = Date.UTC(y, mo, d, h, mi);
  const offsetAt = (utcMs) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
    }).formatToParts(new Date(utcMs)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs;
  };
  let utc = targetWall - offsetAt(targetWall);
  utc = targetWall - offsetAt(utc); // DST 경계 재보정
  return new Date(utc);
}

// UTC Date가 tz에서 며칠·무슨 요일인지
function tzParts(date, tz = TZ) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short",
  }).formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return { y: +p.year, mo: +p.month - 1, d: +p.day, wd: p.weekday };
}

// 예약 가능 슬롯(UTC ISO 문자열 배열). bookedISO: 이미 잡힌 슬롯 ISO Set.
export function generateAvailableSlots(now, bookedISO = new Set(), opts = {}) {
  const tz = opts.tz || TZ;
  const days = opts.days || DAYS;
  const minStart = now.getTime() + (opts.leadMs != null ? opts.leadMs : LEAD_MS);
  const today = tzParts(now, tz);
  const anchor = Date.UTC(today.y, today.mo, today.d, 12); // 정오 UTC = 해당 tz 날짜 안정적 기준
  const out = [];
  for (let i = 0; i < days; i++) {
    const dp = tzParts(new Date(anchor + i * 86400000), tz);
    if (dp.wd === "Sun") continue; // 일요일 휴무
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let mi = 0; mi < 60; mi += SLOT_MINUTES) {
        const slot = wallToUtc(dp.y, dp.mo, dp.d, h, mi, tz);
        if (slot.getTime() < minStart) continue;
        const iso = slot.toISOString();
        if (!bookedISO.has(iso)) out.push(iso);
      }
    }
  }
  return out;
}

// 슬롯을 사람이 읽는 문자열로 — 이메일/시스템 메시지용. tz 미지정 시 영업 타임존(PT).
export function formatSlot(iso, tz = TZ, locale = "en") {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      timeZone: tz || TZ, weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(new Date(iso));
  } catch { return new Date(iso).toISOString(); }
}

// 주어진 ISO가 유효한 영업 슬롯인지(예약 검증용) — 생성 로직과 동일 기준.
export function isValidSlot(iso, now, opts = {}) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const canonical = new Date(t).toISOString();
  if (canonical !== iso) return false; // 정확한 슬롯 경계만
  return generateAvailableSlots(now, new Set(), opts).includes(iso);
}
