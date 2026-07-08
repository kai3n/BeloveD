// Cloudflare R2 미디어 서비스 — 서버는 presigned PUT URL만 발급하고
// 파일은 브라우저가 R2로 직접 업로드한다 (Vercel 함수 4.5MB 바디 제한 우회).
import { randomBytes } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "./errors.js";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);
const MAX_BYTES = 100 * 1024 * 1024; // 100MB (이미지 상한)
const VIDEO_MAX_BYTES = 30 * 1024 * 1024; // 영상 30MB (클라이언트 CHAT_VIDEO_MAX_BYTES와 정렬)
const SIGN_TTL_SECONDS = 60 * 10;

export function r2Configured(env = process.env) {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL);
}

let _client;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      // 브라우저 직접 PUT과 호환: SDK 기본 체크섬 서명이 URL에 박히면
      // 클라이언트가 같은 체크섬을 못 보내 업로드가 거부된다.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

// scope: 업로드 용도별 키 프리픽스 (경로 추측 방지를 위해 랜덤 토큰 포함)
const SCOPES = new Set(["reference", "review", "proposal", "cad", "qc", "style", "chat"]);

export async function createUploadUrl({ scope, contentType, size }) {
  if (!r2Configured()) throw new ApiError("MEDIA_NOT_CONFIGURED", 503);
  if (!SCOPES.has(scope)) throw new ApiError("VALIDATION_ERROR", 400, "bad scope");
  const ct = String(contentType || "").toLowerCase();
  const ext = ALLOWED_TYPES.get(ct);
  if (!ext) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", 400);
  const bytes = Number(size);
  const cap = ct.startsWith("video/") ? VIDEO_MAX_BYTES : MAX_BYTES; // 영상은 서버에서도 30MB 강제
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > cap) {
    throw new ApiError("MEDIA_TOO_LARGE", 400);
  }
  const key = `${scope}/${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString("hex")}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    // content-length를 서명에 포함 → R2가 실제 업로드 바디를 이 크기로 강제한다.
    // (없으면 presigned PUT은 선언 size만 검사하고 실제로는 임의 크기 업로드가 가능 — 용량 남용)
    ContentLength: bytes,
  });
  const uploadUrl = await getSignedUrl(client(), command, {
    expiresIn: SIGN_TTL_SECONDS,
    unhoistableHeaders: new Set(["content-length"]),
  });
  const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key, expiresIn: SIGN_TTL_SECONDS };
}
