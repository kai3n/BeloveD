import { useState } from "react";
import { useLocale } from "../i18n.jsx";
import { getSettings } from "../lib/store.js";

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
  { kind: "image", src: "/assets/lineup-ring.png", labelKey: "sol" },
  { kind: "image", src: "/assets/lineup-band.png", labelKey: "band" },
  { kind: "image", src: "/assets/lineup-pendant.png", labelKey: "pendant" },
  { kind: "image", src: "/assets/lineup-studs.png", labelKey: "studs" },
  { kind: "image", src: "/assets/lineup-bracelet.png", labelKey: "bracelet" },
  { kind: "image", src: "/assets/lab-diamond-tweezers.png", labelKey: "loose" },
  { kind: "video", src: "/assets/diamond-noir-white.mp4", labelKey: "video" },
];

// 영상은 dataURL이 localStorage를 넘치게 하므로 데모에선 이미지보다 한도를 키우되 제한 유지
const MAX_IMAGE_MB = 4;
const MAX_VIDEO_MB = 12;

export function MediaPicker({ value, onChange }) {
  const { p } = useLocale();
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function toggleSample(item) {
    const exists = value.some((m) => m.src === item.src && m.pos === item.pos);
    const media = { kind: item.kind, src: item.src, ...(item.pos ? { pos: item.pos } : {}) };
    onChange(exists ? value.filter((m) => !(m.src === item.src && m.pos === item.pos)) : [...value, media]);
  }
  // 이미지·영상 모두 허용 — 어르신 벤더가 폰에서 찍은 파일을 그대로 끌어다 놓을 수 있게.
  // onChange는 배열만 받으므로(슬롯/인테이크 콜러), 전부 읽어 한 번에 추가한다.
  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const readers = files.map((file) => new Promise((resolve) => {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) { setError(p.picker.typeError); return resolve(null); }
      const limit = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
      if (file.size > limit) { setError(p.picker.fileError(isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB)); return resolve(null); }
      const reader = new FileReader();
      reader.onload = () => resolve({ kind: isVideo ? "video" : "image", src: reader.result });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((items) => {
      const added = items.filter(Boolean);
      if (added.length) { setError(""); onChange([...value, ...added]); }
    });
  }
  function handleFile(e) { addFiles(e.target.files); e.target.value = ""; }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer?.files);
  }

  return (
    <div className="form-stack">
      {/* 큰 드래그&드롭 영역 (히어로) — 클릭하면 파일 선택창. 어르신 벤더가 폰 사진/영상을 끌어다 놓기 */}
      <label
        className={`drop-zone ${dragOver ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input type="file" accept="image/*,video/*" multiple onChange={handleFile} hidden />
        <svg className="drop-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 16V4M12 4l-5 5M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 20h14" strokeLinecap="round" />
        </svg>
        <span className="drop-title">{p.picker.dropHint}</span>
        <span className="form-hint">{p.picker.dropSub}</span>
      </label>
      {value.length > 0 && (
        <div className="picker-grid picker-previews">
          {value.map((m, i) => (
            <div key={i} className="picker-cell is-selected">
              <MediaThumb media={m} alt="" />
              <button type="button" className="chip remove-media" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      {/* 보조: 데모용 샘플 라이브러리 — 실서비스에선 settings.showSampleLibrary=false로 숨김 (드롭존이 기본) */}
      {getSettings().showSampleLibrary !== false && (
        <>
          <p className="form-hint">{p.picker.sampleToggle}</p>
          <div className="picker-grid picker-samples-grid">
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
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
