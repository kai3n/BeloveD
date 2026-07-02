// 실서버 API 클라이언트 — same-origin /v1 (Vercel 프로덕션·vite dev 프록시 공통).
// 정적 데모(GitHub Pages)처럼 서버가 없으면 호출이 실패하고, 호출부는 데모 폴백을 탄다.
export class ApiUnavailableError extends Error {
  constructor() { super("API_UNAVAILABLE"); this.code = "API_UNAVAILABLE"; }
}

export class ApiRequestError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

export async function apiFetch(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/v1${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiUnavailableError(); // 네트워크/서버 부재
  }
  let data = null;
  try { data = await res.json(); } catch { /* 비JSON 응답 */ }
  if (!res.ok) {
    // 정적 호스팅에서 /v1이 SPA로 폴백되면 JSON 계약이 아님 → 서버 부재로 간주
    if (!data?.error?.code) throw new ApiUnavailableError();
    throw new ApiRequestError(data.error.code, res.status);
  }
  return data;
}
