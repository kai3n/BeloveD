import { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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

// eager=true는 히어로/단독 노출처럼 즉시 보여야 할 때만. 그 외(그리드·카드)는 기본 lazy.
export function MediaThumb({ media, ratio = "1 / 1", alt = "", eager = false }) {
  if (!media) return <div className="media-thumb media-empty" style={{ aspectRatio: ratio }} />;
  const src = withBase(media.src);
  if (media.kind === "video") {
    // 그리드 영상 썸네일은 화면 밖에서 버퍼링하지 않도록 preload="none" — 보이면 autoplay
    return <video className="media-thumb" style={{ aspectRatio: ratio }} src={src} muted loop autoPlay playsInline preload="none" />;
  }
  if (media.pos) {
    return (
      <div
        className="media-thumb media-crop" role="img" aria-label={alt}
        style={{ backgroundImage: `url(${src})`, backgroundPosition: media.pos, aspectRatio: ratio }}
      />
    );
  }
  return <img className="media-thumb" style={{ aspectRatio: ratio }} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

export function MediaZoomModal({ mediaItems, activeIndex = 0, onActiveIndexChange, onClose, alt = "" }) {
  const { p } = useLocale();
  const items = (Array.isArray(mediaItems) ? mediaItems : []).filter((item) => item?.src);
  const active = items[activeIndex] || items[0];
  const copy = p.styleDetail || {};

  if (!active) return null;

  function videoType(src) {
    if (/\.webm($|\?)/i.test(src)) return "video/webm";
    if (/\.mov($|\?)/i.test(src)) return "video/quicktime";
    return "video/mp4";
  }

  const slides = items.map((item) => {
    const src = withBase(item.src);
    if (item.kind === "video") {
      return {
        type: "video",
        poster: item.poster ? withBase(item.poster) : undefined,
        controls: true,
        autoPlay: true,
        playsInline: true,
        preload: "metadata",
        sources: [{ src, type: videoType(src) }],
      };
    }
    return {
      src,
      alt,
      imageFit: "contain",
    };
  });

  return (
    <Lightbox
      open
      close={onClose}
      index={activeIndex}
      slides={slides}
      plugins={[Counter, Zoom, Video]}
      className="beloved-lightbox"
      labels={{
        Close: copy.closeViewer || "Close media viewer",
        Previous: copy.previousMedia || "Previous media",
        Next: copy.nextMedia || "Next media",
        "Zoom in": copy.zoomIn || "Zoom in",
        "Zoom out": copy.zoomOut || "Zoom out",
        Lightbox: alt,
        "Photo gallery": alt,
      }}
      counter={{ separator: " / " }}
      carousel={{ imageFit: "contain", padding: "24px", spacing: "24px", preload: 2 }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true, closeOnEscape: true }}
      zoom={{
        maxZoom: 5,
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        doubleClickMaxStops: 4,
        scrollToZoom: true,
        wheelZoomDistanceFactor: 120,
        pinchZoomV4: true,
      }}
      video={{ controls: true, playsInline: true, preload: "metadata" }}
      toolbar={{ buttons: ["zoom", "close"] }}
      styles={{
        container: { backgroundColor: "rgba(2, 3, 3, 0.96)" },
        slide: { background: "#020303" },
      }}
      on={{ view: ({ index }) => onActiveIndexChange?.(index) }}
    />
  );
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateValue(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDisplayDate(value) {
  const date = parseDateValue(value);
  if (!date) return "";
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
}

function calendarCopy(locale) {
  const copy = {
    en: { clear: "Clear", today: "Today", previous: "Previous month", next: "Next month" },
    ko: { clear: "지우기", today: "오늘", previous: "이전 달", next: "다음 달" },
    zh: { clear: "清除", today: "今天", previous: "上个月", next: "下个月" },
    es: { clear: "Borrar", today: "Hoy", previous: "Mes anterior", next: "Mes siguiente" },
  };
  return copy[locale] || copy.en;
}

function calendarCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const firstCell = new Date(year, month, 1 - firstDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === month,
      value: toDateValue(date),
    };
  });
}

export function LuxurySelect({
  value,
  onChange,
  options,
  placeholder = "",
  ariaLabel,
  onFocus,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));
  const label = selected?.label || placeholder;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(option) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function preview(option, event) {
    event.preventDefault();
    event.stopPropagation();
    option.onPreview?.();
    setOpen(false);
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      onFocus?.();
    }
  }

  return (
    <div className={`lux-select ${open ? "is-open" : ""} ${className}`} ref={ref}>
      <button
        type="button"
        className="lux-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onFocus={onFocus}
        onClick={() => {
          if (disabled) return;
          onFocus?.();
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selected ? "lux-select-value" : "lux-select-value is-placeholder"}>{label}</span>
        <ChevronDown className="lux-select-caret" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <ul className="lux-select-list" role="listbox" aria-label={ariaLabel || placeholder}>
        {options.map((option) => {
          const active = String(option.value) === String(value);
          const hasRichContent = option.media || option.onPreview;
          return (
            <li key={option.value || option.label} role="option" aria-selected={active}>
              <div className={`lux-select-option-row ${hasRichContent ? "has-rich-content" : ""}`}>
                <button
                  type="button"
                  className={`lux-select-option-button ${active ? "is-active" : ""}`}
                  disabled={option.disabled}
                  onClick={() => choose(option)}
                >
                  {option.media && (
                    <span className="lux-select-option-thumb" aria-hidden="true">
                      <MediaThumb media={option.media} alt="" />
                    </span>
                  )}
                  <span className="lux-select-option-text">{option.label}</span>
                </button>
                {option.onPreview && (
                  <button
                    type="button"
                    className="lux-select-preview-button"
                    aria-label={`${option.previewLabel || "Preview"} ${option.label}`}
                    title={`${option.previewLabel || "Preview"} ${option.label}`}
                    onClick={(event) => preview(option, event)}
                  >
                    <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{option.previewLabel || "Preview"}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LuxuryDatePicker({
  value,
  onChange,
  placeholder = "mm/dd/yyyy",
  ariaLabel,
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [calendarMaxHeight, setCalendarMaxHeight] = useState(null);
  const selectedDate = parseDateValue(value);
  const [viewMonth, setViewMonth] = useState(() => selectedDate || new Date());
  const ref = useRef(null);
  const copy = calendarCopy(locale);
  const today = new Date();
  const todayValue = toDateValue(today);
  const selectedValue = selectedDate ? toDateValue(selectedDate) : "";
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewMonth);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 5, 21 + index))
  ));

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate);
  }, [value]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const calendarHeight = 408;
    const viewportGap = 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldDropUp = spaceBelow < calendarHeight && spaceAbove > spaceBelow;
    const available = (shouldDropUp ? spaceAbove : spaceBelow) - viewportGap;
    setDropUp(shouldDropUp);
    setCalendarMaxHeight(Math.max(300, Math.min(calendarHeight, available)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function shiftMonth(delta) {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function selectDate(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`lux-date ${open ? "is-open" : ""} ${dropUp ? "drops-up" : ""}`} ref={ref}>
      <button
        type="button"
        className="lux-date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? "lux-date-value" : "lux-date-value is-placeholder"}>{formatDisplayDate(value) || placeholder}</span>
        <CalendarDays className="lux-date-icon" size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <div
        className="lux-calendar"
        role="dialog"
        aria-label={ariaLabel || placeholder}
        style={calendarMaxHeight ? { "--lux-calendar-max-height": `${calendarMaxHeight}px` } : undefined}
      >
        <div className="lux-calendar-head">
          <strong>{monthLabel}</strong>
          <div className="lux-calendar-nav">
            <button type="button" aria-label={copy.previous} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" aria-label={copy.next} onClick={() => shiftMonth(1)}>
              <ChevronRight size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="lux-calendar-grid lux-calendar-weekdays">
          {weekdayLabels.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="lux-calendar-grid">
          {calendarCells(viewMonth).map((cell) => (
            <button
              type="button"
              key={cell.value}
              className={`lux-calendar-day ${cell.inMonth ? "" : "is-muted"} ${cell.value === todayValue ? "is-today" : ""} ${cell.value === selectedValue ? "is-selected" : ""}`}
              onClick={() => selectDate(cell.value)}
            >
              {cell.date.getDate()}
            </button>
          ))}
        </div>
        <div className="lux-calendar-actions">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}>{copy.clear}</button>
          <button type="button" onClick={() => selectDate(todayValue)}>{copy.today}</button>
        </div>
      </div>
    </div>
  );
}

// 샘플 라이브러리(영구 저장) + 파일 업로드. 이미지는 브라우저에서 리사이즈/압축하고,
// 영상은 base64로 localStorage를 터뜨리지 않도록 blob URL preview로 다룬다.
const SAMPLE_LIBRARY = [
  { kind: "image", src: "/assets/lineup-ring.png", labelKey: "sol" },
  { kind: "image", src: "/assets/lineup-band.png", labelKey: "band" },
  { kind: "image", src: "/assets/lineup-pendant.png", labelKey: "pendant" },
  { kind: "image", src: "/assets/lineup-studs.png", labelKey: "studs" },
  { kind: "image", src: "/assets/lineup-bracelet.png", labelKey: "bracelet" },
  { kind: "image", src: "/assets/lab-diamond-tweezers.webp", labelKey: "loose" },
  { kind: "video", src: "/assets/diamond-noir-white.mp4", labelKey: "video" },
];

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_TARGET_BYTES = 650 * 1024;
const IMAGE_MIN_QUALITY = 0.58;
const IMAGE_START_QUALITY = 0.86;
const MAX_VIDEO_MB = 50;

function mediaKindFromFile(file) {
  const name = file.name || "";
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)) return "image";
  return null;
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function readBlobAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("fileReadFailed"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImageFromFile(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).then((bitmap) => ({
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close?.(),
    }));
  }

  return readBlobAsDataURL(file).then((src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, width, height) => ctx.drawImage(img, 0, 0, width, height),
      close: () => {},
    });
    img.onerror = reject;
    img.src = src;
  }));
}

async function optimizeImageFile(file) {
  const image = await loadImageFromFile(file);
  const originalWidth = image.width;
  const originalHeight = image.height;
  const canvas = document.createElement("canvas");
  let maxDimension = IMAGE_MAX_DIMENSION;
  let width = originalWidth;
  let height = originalHeight;
  let blob = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, width, height);
    image.draw(ctx, width, height);

    let quality = IMAGE_START_QUALITY;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob && blob.size > IMAGE_TARGET_BYTES && quality > IMAGE_MIN_QUALITY) {
      quality = Math.max(IMAGE_MIN_QUALITY, quality - 0.08);
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
    if (!blob || blob.size <= IMAGE_TARGET_BYTES || maxDimension <= 900) break;
    maxDimension = Math.max(900, Math.round(maxDimension * 0.82));
  }
  image.close();
  if (!blob) throw new Error("imageOptimizeFailed");
  const src = await readBlobAsDataURL(blob);
  return {
    kind: "image",
    src,
    name: file.name || "reference.jpg",
    size: blob.size,
    originalSize: file.size,
    width,
    height,
    optimized: blob.size < file.size || width !== originalWidth || height !== originalHeight,
  };
}

function optimizeVideoFile(file) {
  const limit = MAX_VIDEO_MB * 1024 * 1024;
  if (file.size > limit) throw new Error("videoTooLarge");
  return {
    kind: "video",
    src: URL.createObjectURL(file),
    name: file.name || "reference-video",
    size: file.size,
    originalSize: file.size,
    optimized: true,
    transient: true,
  };
}

export function MediaPicker({ value, onChange, maxItems = Infinity, showSamples = true, previewMode = "thumb" }) {
  const { p } = useLocale();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const hasLimit = Number.isFinite(maxItems);
  const remainingSlots = hasLimit ? Math.max(0, maxItems - value.length) : Infinity;

  function toggleSample(item) {
    if (!showSamples) return;
    const exists = value.some((m) => m.src === item.src && m.pos === item.pos);
    const media = { kind: item.kind, src: item.src, ...(item.pos ? { pos: item.pos } : {}) };
    if (!exists && value.length >= maxItems) {
      setError(p.picker.maxError(maxItems));
      return;
    }
    onChange(exists ? value.filter((m) => !(m.src === item.src && m.pos === item.pos)) : [...value, media]);
  }
  async function prepareFile(file) {
    const kind = mediaKindFromFile(file);
    if (!kind) throw new Error("unsupportedType");
    if (kind === "video") return optimizeVideoFile(file);
    return optimizeImageFile(file);
  }

  // 이미지·영상 모두 허용. 이미지는 작게 압축하고, 영상은 가벼운 preview URL로 처리한다.
  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (remainingSlots <= 0) {
      setError(p.picker.maxError(maxItems));
      return;
    }
    const selected = files.slice(0, remainingSlots);
    setBusy(true);
    setError("");
    setNotice(p.picker.optimizing || "");
    try {
      const results = await Promise.allSettled(selected.map(prepareFile));
      const added = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const failed = results.find((result) => result.status === "rejected")?.reason;
      if (files.length > remainingSlots) setError(p.picker.maxError(maxItems));
      else if (failed?.message === "videoTooLarge") setError(p.picker.fileError(MAX_VIDEO_MB));
      else if (failed?.message === "unsupportedType") setError(p.picker.typeError);
      else if (failed) setError(p.picker.optimizeError || p.picker.typeError);
      if (added.length) {
        onChange([...value, ...added]);
        const compressed = added.filter((item) => item.kind === "image" && item.optimized).length;
        const videoCount = added.filter((item) => item.kind === "video").length;
        setNotice(
          compressed > 0
            ? p.picker.optimizedNotice(compressed)
            : videoCount > 0
              ? p.picker.videoNotice
              : "",
        );
      }
    } finally {
      setBusy(false);
    }
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
      <input
        ref={inputRef}
        className="visually-hidden-file-input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFile}
      />
      <button
        type="button"
        className={`drop-zone ${dragOver ? "is-over" : ""}`}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <svg className="drop-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 16V4M12 4l-5 5M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 20h14" strokeLinecap="round" />
        </svg>
        <span className="drop-title">{busy ? p.picker.optimizing : p.picker.dropHint}</span>
        <span className="form-hint">
          {hasLimit ? p.picker.limitHint(value.length, maxItems) : p.picker.dropSub}
        </span>
      </button>
      {value.length > 0 && (
        previewMode === "list" ? (
          <div className="picker-list" aria-label={p.picker.attachedLabel || p.picker.hint(value.length)}>
            {value.map((m, i) => {
              const kindLabel = m.kind === "video" ? p.picker.videoLabel || "Video" : p.picker.photoLabel || "Photo";
              const sizeLabel = formatFileSize(m.size);
              return (
                <div key={i} className="picker-list-item">
                  <div className="picker-file-meta">
                    <span className="picker-file-kind">{kindLabel}</span>
                    <strong>{m.name || `${kindLabel} ${i + 1}`}</strong>
                    {(sizeLabel || m.optimized) && (
                      <span className="picker-file-size">
                        {[sizeLabel, m.optimized ? p.picker.optimizedLabel : ""].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  <button type="button" className="picker-remove-button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                    {p.picker.removeLabel || "Remove"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="picker-grid picker-previews">
            {value.map((m, i) => (
              <div key={i} className="picker-cell is-selected">
                <MediaThumb media={m} alt="" />
                <button type="button" className="chip remove-media" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )
      )}
      {/* 보조: 데모용 샘플 라이브러리 — 실서비스에선 settings.showSampleLibrary=false로 숨김 (드롭존이 기본) */}
      {showSamples && getSettings().showSampleLibrary !== false && (
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
      {notice && !error && <p className="form-hint">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
