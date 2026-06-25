import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
          return (
            <li key={option.value || option.label} role="option" aria-selected={active}>
              <button
                type="button"
                className={active ? "is-active" : ""}
                disabled={option.disabled}
                onClick={() => choose(option)}
              >
                {option.label}
              </button>
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

// 샘플 라이브러리(영구 저장) + 파일 업로드(dataURL, 데모용 2MB 제한)
const SAMPLE_LIBRARY = [
  { kind: "image", src: "/assets/lineup-ring.png", labelKey: "sol" },
  { kind: "image", src: "/assets/lineup-band.png", labelKey: "band" },
  { kind: "image", src: "/assets/lineup-pendant.png", labelKey: "pendant" },
  { kind: "image", src: "/assets/lineup-studs.png", labelKey: "studs" },
  { kind: "image", src: "/assets/lineup-bracelet.png", labelKey: "bracelet" },
  { kind: "image", src: "/assets/lab-diamond-tweezers.webp", labelKey: "loose" },
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
