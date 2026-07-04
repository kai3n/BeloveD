// 서버 ↔ 로컬 스토어 동기화 — 카탈로그(스타일)·가격표·운영 설정.
// 읽기: 부팅 시 서버 값으로 스토어를 덮어쓴다(서버가 진실).
// 쓰기: 어드민 페이지가 로컬 저장 직후 서버로 밀어넣는다(write-through).
// 서버가 없는 정적 데모 빌드에서는 모두 조용히 스킵되어 시드/로컬 동작을 유지한다.
import { apiFetch, ApiUnavailableError } from "./api.js";
import { hydrateFromServer } from "./store.js";

function quiet(promise, label) {
  return promise.catch((e) => {
    if (!(e instanceof ApiUnavailableError)) console.warn(`[serverSync] ${label}:`, e.code || e.message);
  });
}

let publicSynced = false;
// 공개 카탈로그 + 공개 설정 — 모든 방문자의 부팅 경로 (published 스타일만)
export async function syncCatalogFromServer() {
  if (publicSynced) return;
  publicSynced = true;
  try {
    const [designs, settings] = await Promise.all([
      apiFetch("/designs"),
      apiFetch("/settings/public"),
    ]);
    hydrateFromServer({ styles: designs.styles, settings: settings.settings });
  } catch { /* 서버 부재(정적 데모)·일시 장애 — 시드 유지 */ }
}

// 어드민 콘솔 부팅 경로 — 비공개 초안까지 포함한 전체 스타일 목록으로 재하이드레이션
export async function syncAdminCatalogFromServer() {
  try {
    const [designs, settings] = await Promise.all([
      apiFetch("/admin/designs"),
      apiFetch("/admin/settings"),
    ]);
    hydrateFromServer({ styles: designs.styles, settings: settings.settings });
  } catch { /* 데모 빌드·세션 만료 — 로컬 상태 유지 */ }
}

// ── 어드민 write-through ──
export function pushStyleToServer(style) {
  return quiet(apiFetch(`/admin/designs/${encodeURIComponent(style.id)}`, { method: "PUT", body: style }), "style");
}

export function deleteStyleOnServer(styleId) {
  return quiet(apiFetch(`/admin/designs/${encodeURIComponent(styleId)}`, { method: "DELETE" }), "style-delete");
}

export function pushSettingsToServer(patch) {
  return quiet(apiFetch("/admin/settings", { method: "PUT", body: patch }), "settings");
}
