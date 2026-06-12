// 딜러 네트워크 순수 로직 — 가격/티어/클레임 (스펙 §5.5)

// 메탈 변동가: 중량 g × 금 시세(g당) × 순도 + 공임
export function metalQuote(item, goldSpotPerGram, goldPurity) {
  return Math.round(item.metalGrams * goldSpotPerGram * goldPurity + item.laborUsd);
}

// 도매 단가 = 티어별 스톤 고정가 + 메탈 견적
export function unitWholesale(item, tier, settings) {
  const stone = tier === 1 ? item.stoneWholesaleT1 : item.stoneWholesaleT2;
  return stone + metalQuote(item, settings.goldSpotPerGram, settings.goldPurity);
}

// 샐비지 크레딧 = 회수 골드 g × 스팟 × 75% (공장 상계 공식)
export function salvageCredit(goldGrams, goldSpotPerGram) {
  return Math.round(goldGrams * goldSpotPerGram * 0.75);
}

export function quarterKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function prevQuarterKey(date, back) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - 3 * back);
  return quarterKey(d);
}

// 티어 산정: 오버라이드 > 이번 분기 임계 충족(T1) > T1 딜러 2분기 연속 미달 시 강등(T2)
export function computeTier(orders, profile, settings, now = new Date()) {
  const valid = orders.filter((o) => o.status !== "CANCELLED");
  const volByQuarter = {};
  for (const o of valid) {
    const k = quarterKey(o.createdAt);
    volByQuarter[k] = (volByQuarter[k] || 0) + o.totalUsd;
  }
  const currentQ = quarterKey(now);
  const quarterVolume = volByQuarter[currentQ] || 0;

  if (profile.tierOverride) {
    return { tier: profile.tierOverride, quarterVolume, override: true };
  }
  if (quarterVolume >= settings.tierThresholdUsd) {
    return { tier: 1, quarterVolume };
  }
  if (profile.tier === 1) {
    // 직전 2개 분기(현재 분기 제외)가 모두 미달이면 강등
    const below = [1, 2].every((back) => (volByQuarter[prevQuarterKey(now, back)] || 0) < settings.tierThresholdUsd);
    return { tier: below ? 2 : 1, quarterVolume };
  }
  return { tier: 2, quarterVolume };
}

// 클레임 상태머신: 제출 → 승인/반려, 승인 → 반환 대기 → 반환 수령(샐비지) → 교체 발송
export const CLAIM_STATUSES = ["SUBMITTED", "APPROVED", "DENIED", "AWAITING_RETURN", "RETURN_RECEIVED", "REPLACED"];

const CLAIM_FLOW = {
  SUBMITTED: ["APPROVED", "DENIED"],
  APPROVED: ["AWAITING_RETURN"],
  AWAITING_RETURN: ["RETURN_RECEIVED"],
  RETURN_RECEIVED: ["REPLACED"],
  DENIED: [],
  REPLACED: [],
};

export function canClaimTransition(from, to) {
  return (CLAIM_FLOW[from] || []).includes(to);
}

export function assertClaimTransition(from, to) {
  if (!canClaimTransition(from, to)) {
    throw new Error(`Invalid claim transition ${from} -> ${to}`);
  }
}
