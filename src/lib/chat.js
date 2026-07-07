// 라이브챗 클라이언트 — same-origin /v1/chat. 서버 부재(정적 데모)면 apiFetch가 던지고
// 위젯은 조용히 접힌 상태를 유지한다.
import { apiFetch } from "./api.js";

export async function sendChatMessage({ body, attachments, locale, email } = {}) {
  return apiFetch("/chat/messages", { method: "POST", body: { body, attachments, locale, email } });
}

// peek=true → 서버가 읽음/last_seen을 갱신하지 않는다(닫힌 버블의 미확인 뱃지 폴링용).
export async function fetchThread({ since = 0, peek = false } = {}) {
  const q = new URLSearchParams();
  if (since) q.set("since", String(since));
  if (peek) q.set("peek", "1");
  const qs = q.toString();
  return apiFetch(`/chat/thread${qs ? `?${qs}` : ""}`);
}

export async function closeChatThread() {
  return apiFetch("/chat/close", { method: "POST", body: {} });
}

// 채팅 이미지 — /chat/upload-url presigned 발급 후 R2로 직행 PUT, 영구 URL 반환.
export async function uploadChatImage(blob, contentType) {
  const { uploadUrl, publicUrl } = await apiFetch("/chat/upload-url", {
    method: "POST",
    body: { contentType, size: blob.size },
  });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!res.ok) throw new Error("UPLOAD_FAILED");
  return publicUrl;
}
