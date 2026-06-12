import { useState } from "react";
import { useLocale } from "../i18n.jsx";

// 신규 화면 공통 빌딩블록. 라벨은 전부 useLocale().p 사전에서 — 4개 언어 지원.
// 샘플 사진은 jewelry-lineup.png 크롭(pos) 또는 단일 이미지(src).

// 가격은 미국 달러($)로만 표기한다 (2026-06-12 사용자 확정)
export function usd(n) {
  return `$${Number(n || 0).toLocaleString("en-US")}`;
}

// GitHub Pages 등 하위 경로 배포 시 /assets/* 경로에 base를 붙인다 (dataURL은 그대로)
export function withBase(src) {
  const base = import.meta.env.BASE_URL || "/";
  if (!src || !src.startsWith("/") || base === "/") return src;
  return base.replace(/\/$/, "") + src;
}

export function MediaThumb({ media, ratio = "1 / 1", alt = "" }) {
  if (!media) return <div className="media-thumb media-empty" style={{ aspectRatio: ratio }} />;
  const src = withBase(media.src);
  if (media.kind === "video") {
    return <video className="media-thumb" style={{ aspectRatio: ratio }} src={src} muted loop autoPlay playsInline />;
  }
  if (media.pos) {
    return (
      <div
        className="media-thumb media-crop" role="img" aria-label={alt}
        style={{ backgroundImage: `url(${src})`, backgroundPosition: media.pos, aspectRatio: ratio }}
      />
    );
  }
  return <img className="media-thumb" style={{ aspectRatio: ratio }} src={src} alt={alt} />;
}

export function StatusBadge({ status }) {
  const { p } = useLocale();
  return <span className={`status-badge st-${status}`}>{p.status[status] || status}</span>;
}

// steps: [{key,label}], currentIndex: 진행 인덱스 (-1이면 미시작)
export function Stepper({ steps, currentIndex }) {
  return (
    <ol className="stepper">
      {steps.map((step, i) => (
        <li key={step.key} className={i < currentIndex ? "done" : i === currentIndex ? "current" : ""}>
          <span className="dot" />
          <span className="step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyNote({ children }) {
  return <p className="empty-note">{children}</p>;
}

// 샘플 라이브러리(영구 저장) + 파일 업로드(dataURL, 데모용 2MB 제한)
const SAMPLE_LIBRARY = [
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "0% center", labelKey: "sol" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "24% center", labelKey: "band" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "50% center", labelKey: "pendant" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "72% center", labelKey: "studs" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "100% center", labelKey: "bracelet" },
  { kind: "image", src: "/assets/lab-diamond-tweezers.png", labelKey: "loose" },
  { kind: "video", src: "/assets/diamond-noir-white.mp4", labelKey: "video" },
];

export function MediaPicker({ value, onChange }) {
  const { p } = useLocale();
  const [error, setError] = useState("");

  function toggleSample(item) {
    const exists = value.some((m) => m.src === item.src && m.pos === item.pos);
    const media = { kind: item.kind, src: item.src, ...(item.pos ? { pos: item.pos } : {}) };
    onChange(exists ? value.filter((m) => !(m.src === item.src && m.pos === item.pos)) : [...value, media]);
  }
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError(p.picker.fileError); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () => onChange([...value, { kind: "image", src: reader.result }]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="form-stack">
      <p className="form-hint">{p.picker.hint(value.length)}</p>
      <div className="picker-grid">
        {SAMPLE_LIBRARY.map((item, i) => {
          const selected = value.some((m) => m.src === item.src && m.pos === item.pos);
          return (
            <button type="button" key={i} className={`picker-cell ${selected ? "is-selected" : ""}`} onClick={() => toggleSample(item)}>
              <MediaThumb media={item} alt={p.picker.labels[item.labelKey]} />
              <span>{p.picker.labels[item.labelKey]}</span>
            </button>
          );
        })}
      </div>
      <label className="field"><span>{p.picker.fileLabel}</span>
        <input type="file" accept="image/*" onChange={handleFile} /></label>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
