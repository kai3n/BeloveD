import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import {
  deleteOpsStyle,
  deleteStyleSpec,
  getSettings,
  listOpsStyles,
  listStyleSpecs,
  saveOpsStyle,
  saveStyleSpec,
  updateSettings,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";
import { defaultSubcategoryFor, styleSubcategoryKey, subcategoryKeysFor } from "../../lib/designSlots.js";
import { opsStrings } from "../../opsStrings.js";
import { ConsoleHead, StatStrip } from "./console.jsx";
import { deleteStyleOnServer, pushSettingsToServer, pushStyleToServer } from "../../lib/serverSync.js";

const FALLBACK_MEDIA = "/assets/lab-diamond-tweezers.webp";
const MAX_STYLE_MEDIA = 5;
const STYLE_LOCALES = [
  { key: "en", label: "EN" },
  { key: "ko", label: "KO" },
  { key: "zh", label: "ZH" },
  { key: "es", label: "ES" },
];

const ADMIN_STYLE_UI = {
  en: {
    kicker: "Style operations",
    headline: "Clean starter styles. Easy edits.",
    sub: "Add, edit, publish, and manage the sample designs customers choose before submitting references.",
    library: "Library",
    libraryHint: "Select a style to edit. New styles stay private until published.",
    searchPh: "Search name or ID",
    untitled: "Untitled style",
    emptyList: "No styles match here yet.",
    countLabel: (n) => `${n} styles`,
    statStyles: "Styles",
    forSaleShort: "For sale",
    draftShort: "Draft",
    newStyle: "New style",
    editStyle: "Edit style",
    draftStyle: "Create new style",
    basics: "Basics",
    names: "Localized names",
    publicText: "Public detail text",
    media: "Media",
    production: "Production defaults",
    status: "Status",
    readyForSale: "Ready for customers",
    privateDraft: "Private draft",
    published: "Published",
    hidden: "Hidden",
    cover: "Cover",
    mediaEmpty: "Upload up to five photos or videos. The first file becomes the cover.",
    mediaCount: (n) => `${n}/5 files`,
    categoryAll: "All",
    deleteConfirm: (id) => `Delete ${id}?`,
    advancedCopy: "Catalog copy",
    advancedCopyHint: "Public catalog header text. Keep this collapsed unless you are changing page messaging.",
    specsTitle: "Production specs",
    specsHint: "Optional style-specific defaults for internal quoting. Global diamond pricing stays in Diamond Pricing.",
    autoId: "ID is generated after save",
    saveStyle: "Save style",
    addStyle: "Add style",
    savingStyle: "Saving...",
    savedStyle: "Style saved.",
    addedStyle: "New style saved.",
    deletedStyle: "Style deleted.",
    specSaved: "Production spec saved.",
    specDeleted: "Production spec deleted.",
    saveFailed: "Could not save. Please check the required fields.",
    catalogSaved: "Catalog copy saved.",
  },
  ko: {
    kicker: "스타일 운영",
    headline: "샘플 디자인은 깔끔하게. 수정은 빠르게.",
    sub: "고객이 주문 전 선택하는 샘플 디자인을 추가, 수정, 공개, 미디어 관리까지 한 곳에서 처리합니다.",
    library: "라이브러리",
    libraryHint: "수정할 스타일을 선택하세요. 새 스타일은 공개 전까지 비공개로 관리됩니다.",
    searchPh: "이름·ID 검색",
    untitled: "이름 없는 스타일",
    emptyList: "조건에 맞는 스타일이 없습니다.",
    countLabel: (n) => `${n}개 스타일`,
    statStyles: "스타일",
    forSaleShort: "판매중",
    draftShort: "초안",
    newStyle: "새 스타일",
    editStyle: "스타일 수정",
    draftStyle: "새 스타일 만들기",
    basics: "기본 정보",
    names: "언어별 이름",
    publicText: "상세 페이지 문구",
    media: "미디어",
    production: "제작 기본값",
    status: "상태",
    readyForSale: "고객에게 노출 가능",
    privateDraft: "비공개 초안",
    published: "공개됨",
    hidden: "숨김",
    cover: "커버",
    mediaEmpty: "사진이나 영상을 최대 5개까지 올리세요. 첫 번째 파일이 커버가 됩니다.",
    mediaCount: (n) => `${n}/5개 파일`,
    categoryAll: "전체",
    deleteConfirm: (id) => `${id} 스타일을 삭제할까요?`,
    advancedCopy: "카탈로그 문구",
    advancedCopyHint: "공개 디자인 목록의 헤더 문구입니다. 페이지 메시지를 바꿀 때만 열어 수정하세요.",
    specsTitle: "제작 스펙",
    specsHint: "내부 견적용 스타일별 기본값입니다. 전체 다이아 가격 조정은 다이아 벤치마크에서 유지합니다.",
    autoId: "저장 후 ID가 자동 생성됩니다",
    saveStyle: "스타일 저장",
    addStyle: "스타일 추가",
    savingStyle: "저장 중...",
    savedStyle: "스타일이 저장됐습니다.",
    addedStyle: "새 스타일이 저장됐습니다.",
    deletedStyle: "스타일이 삭제됐습니다.",
    specSaved: "제작 스펙이 저장됐습니다.",
    specDeleted: "제작 스펙이 삭제됐습니다.",
    saveFailed: "저장하지 못했습니다. 필수 항목을 확인해 주세요.",
    catalogSaved: "카탈로그 문구가 저장됐습니다.",
  },
  zh: {
    kicker: "款式运营",
    headline: "样式清晰，编辑更快。",
    sub: "集中添加、编辑、发布并管理客户下单前看到的样式和媒体。",
    library: "款式库",
    libraryHint: "选择要编辑的款式。新款式发布前保持私密。",
    searchPh: "搜索名称或 ID",
    untitled: "未命名款式",
    emptyList: "没有符合条件的款式。",
    countLabel: (n) => `${n} 款`,
    statStyles: "款式",
    forSaleShort: "可售",
    draftShort: "草稿",
    newStyle: "新款式",
    editStyle: "编辑款式",
    draftStyle: "创建新款式",
    basics: "基础信息",
    names: "多语言名称",
    publicText: "详情页文案",
    media: "媒体",
    production: "制作默认值",
    status: "状态",
    readyForSale: "可展示给客户",
    privateDraft: "私密草稿",
    published: "已发布",
    hidden: "隐藏",
    cover: "封面",
    mediaEmpty: "最多上传五张照片或视频。第一个文件将作为封面。",
    mediaCount: (n) => `${n}/5 个文件`,
    categoryAll: "全部",
    deleteConfirm: (id) => `删除 ${id}？`,
    advancedCopy: "目录文案",
    advancedCopyHint: "公开款式目录的标题文案。仅在调整页面信息时打开。",
    specsTitle: "制作规格",
    specsHint: "内部报价用的款式默认值。全局钻石价格仍在 Diamond Pricing 中维护。",
    autoId: "保存后自动生成 ID",
    saveStyle: "保存款式",
    addStyle: "添加款式",
    savingStyle: "正在保存...",
    savedStyle: "款式已保存。",
    addedStyle: "新款式已保存。",
    deletedStyle: "款式已删除。",
    specSaved: "制作规格已保存。",
    specDeleted: "制作规格已删除。",
    saveFailed: "保存失败。请检查必填项。",
    catalogSaved: "目录文案已保存。",
  },
  es: {
    kicker: "Operaciones de estilos",
    headline: "Diseños limpios. Edición rápida.",
    sub: "Agrega, edita, publica y administra los diseños de muestra que el cliente elige antes de enviar referencias.",
    library: "Biblioteca",
    libraryHint: "Selecciona un estilo para editar. Los nuevos estilos quedan privados hasta publicarse.",
    searchPh: "Buscar nombre o ID",
    untitled: "Estilo sin título",
    emptyList: "No hay estilos que coincidan.",
    countLabel: (n) => `${n} estilos`,
    statStyles: "Estilos",
    forSaleShort: "En venta",
    draftShort: "Borrador",
    newStyle: "Nuevo estilo",
    editStyle: "Editar estilo",
    draftStyle: "Crear estilo",
    basics: "Datos básicos",
    names: "Nombres por idioma",
    publicText: "Texto público",
    media: "Media",
    production: "Producción",
    status: "Estado",
    readyForSale: "Visible para clientes",
    privateDraft: "Borrador privado",
    published: "Publicado",
    hidden: "Oculto",
    cover: "Portada",
    mediaEmpty: "Sube hasta cinco fotos o videos. El primer archivo será la portada.",
    mediaCount: (n) => `${n}/5 archivos`,
    categoryAll: "Todo",
    deleteConfirm: (id) => `¿Eliminar ${id}?`,
    advancedCopy: "Texto del catálogo",
    advancedCopyHint: "Texto del encabezado del catálogo público. Ábrelo solo si cambias el mensaje de la página.",
    specsTitle: "Especificaciones",
    specsHint: "Valores internos por estilo para cotización. El precio global de diamantes queda en Diamond Pricing.",
    autoId: "El ID se genera al guardar",
    saveStyle: "Guardar estilo",
    addStyle: "Agregar estilo",
    savingStyle: "Guardando...",
    savedStyle: "Estilo guardado.",
    addedStyle: "Nuevo estilo guardado.",
    deletedStyle: "Estilo eliminado.",
    specSaved: "Especificación guardada.",
    specDeleted: "Especificación eliminada.",
    saveFailed: "No se pudo guardar. Revisa los campos requeridos.",
    catalogSaved: "Texto del catálogo guardado.",
  },
};

const emptyDraft = {
  id: "",
  nameEn: "",
  nameKo: "",
  nameZh: "",
  nameEs: "",
  labelEn: "",
  labelKo: "",
  labelZh: "",
  labelEs: "",
  introEn: "",
  introKo: "",
  introZh: "",
  introEs: "",
  flexibleEn: "",
  flexibleKo: "",
  flexibleZh: "",
  flexibleEs: "",
  beforeEn: "",
  beforeKo: "",
  beforeZh: "",
  beforeEs: "",
  category: "ring",
  subcategory: defaultSubcategoryFor("ring"),
  estWeightG: "",
  laborUsd: "",
  leadDays: "",
  published: false,
  availableForSale: false,
  media: [],
};

function mediaFromStyle(style) {
  if (!style) return [];
  if (Array.isArray(style.media) && style.media.length > 0) return style.media;
  if (style.coverImage) return [{ kind: style.coverImage.endsWith(".mp4") ? "video" : "image", src: style.coverImage }];
  return [];
}

function fieldName(prefix, locale) {
  return `${prefix}${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
}

function draftI18n(draft, prefix, fallbackPrefix = null) {
  return STYLE_LOCALES.reduce((obj, { key }) => {
    const value = draft[fieldName(prefix, key)] || (fallbackPrefix ? draft[fieldName(fallbackPrefix, key)] : "");
    obj[key] = value;
    return obj;
  }, {});
}

function styleI18n(style, field, locale) {
  return style[field]?.[locale] || "";
}

function draftFromStyle(style) {
  return {
    id: style.id,
    nameEn: style.name?.en || pickI18n(style.name, "en"),
    nameKo: style.name?.ko || pickI18n(style.name, "ko"),
    nameZh: style.name?.zh || pickI18n(style.name, "zh"),
    nameEs: style.name?.es || pickI18n(style.name, "es"),
    labelEn: styleI18n(style, "detailLabel", "en"),
    labelKo: styleI18n(style, "detailLabel", "ko"),
    labelZh: styleI18n(style, "detailLabel", "zh"),
    labelEs: styleI18n(style, "detailLabel", "es"),
    introEn: styleI18n(style, "description", "en"),
    introKo: styleI18n(style, "description", "ko"),
    introZh: styleI18n(style, "description", "zh"),
    introEs: styleI18n(style, "description", "es"),
    flexibleEn: styleI18n(style, "flexibleText", "en"),
    flexibleKo: styleI18n(style, "flexibleText", "ko"),
    flexibleZh: styleI18n(style, "flexibleText", "zh"),
    flexibleEs: styleI18n(style, "flexibleText", "es"),
    beforeEn: styleI18n(style, "beforeProductionText", "en"),
    beforeKo: styleI18n(style, "beforeProductionText", "ko"),
    beforeZh: styleI18n(style, "beforeProductionText", "zh"),
    beforeEs: styleI18n(style, "beforeProductionText", "es"),
    category: style.category || "ring",
    subcategory: styleSubcategoryKey(style),
    estWeightG: String(style.estWeightG ?? ""),
    laborUsd: String(style.laborUsd ?? ""),
    leadDays: String(style.leadDays ?? ""),
    published: Boolean(style.published),
    availableForSale: Boolean(style.availableForSale),
    media: mediaFromStyle(style),
  };
}

function styleFromDraft(draft) {
  const media = (draft.media || []).slice(0, MAX_STYLE_MEDIA);
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: {
      en: draft.nameEn || draft.nameKo || draft.nameZh || draft.nameEs,
      ko: draft.nameKo || draft.nameEn || draft.nameZh || draft.nameEs,
      zh: draft.nameZh || draft.nameEn || draft.nameKo || draft.nameEs,
      es: draft.nameEs || draft.nameEn || draft.nameKo || draft.nameZh,
    },
    detailLabel: draftI18n(draft, "label"),
    description: draftI18n(draft, "intro"),
    flexibleText: draftI18n(draft, "flexible"),
    beforeProductionText: draftI18n(draft, "before"),
    category: draft.category,
    subcategory: draft.subcategory || defaultSubcategoryFor(draft.category),
    coverImage: media[0]?.src || FALLBACK_MEDIA,
    media,
    mediaComplete: media.length > 0,
    metalOptions: ["18kw", "18ky", "pt"],
    estWeightG: Number(draft.estWeightG) || 0,
    laborUsd: Number(draft.laborUsd) || 0,
    leadDays: Number(draft.leadDays) || 0,
    published: draft.published,
    availableForSale: draft.availableForSale,
  };
}

function catalogCopyDraft(settings) {
  const designCopy = settings.designCopy || {};
  return STYLE_LOCALES.reduce((acc, { key }) => {
    const fallback = opsStrings[key]?.styleCat || opsStrings.en.styleCat;
    const source = designCopy[key] || {};
    acc[key] = {
      kicker: source.kicker || fallback.kicker || "",
      heroTitle: source.heroTitle || fallback.heroTitle || fallback.title || "",
      sub: source.sub || fallback.sub || "",
      categoryNote: source.categoryNote || (
        typeof fallback.categoryNote === "function"
          ? fallback.categoryNote("{count}")
          : "{count} sample directions. Almost any shape can be reviewed from your reference."
      ),
    };
    return acc;
  }, {});
}

function editorCopy(locale) {
  return ADMIN_STYLE_UI[locale] || ADMIN_STYLE_UI.en;
}

function mediaCountLabel(style) {
  return mediaFromStyle(style).length;
}

function newDraftForCategory(category) {
  const nextCategory = category && category !== "all" ? category : "ring";
  return {
    ...emptyDraft,
    category: nextCategory,
    subcategory: defaultSubcategoryFor(nextCategory),
  };
}

function StyleMediaManager({ media, onChange, copy }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMedia = media[activeIndex] || null;

  useEffect(() => {
    if (activeIndex > Math.max(0, media.length - 1)) {
      setActiveIndex(Math.max(0, media.length - 1));
    }
  }, [activeIndex, media.length]);

  function shift(delta) {
    if (media.length <= 1) return;
    setActiveIndex((current) => (current + delta + media.length) % media.length);
  }

  return (
    <div className="admin-media-manager">
      <div className={`admin-media-stage ${activeMedia ? "" : "is-empty"}`}>
        {activeMedia ? (
          <MediaThumb media={activeMedia} ratio="1 / 1" alt={copy.media} eager />
        ) : (
          <div className="admin-media-empty">
            <span>{copy.cover}</span>
            <p>{copy.mediaEmpty}</p>
          </div>
        )}
        {media.length > 1 && (
          <>
            <button type="button" className="admin-media-arrow is-left" aria-label="Previous media" onClick={() => shift(-1)}>
              <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button type="button" className="admin-media-arrow is-right" aria-label="Next media" onClick={() => shift(1)}>
              <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </>
        )}
        <span className="admin-media-counter">{copy.mediaCount(media.length)}</span>
      </div>
      <MediaPicker
        value={media}
        maxItems={MAX_STYLE_MEDIA}
        showSamples={false}
        previewMode="list"
        scope="style"
        onChange={(nextMedia) => onChange(nextMedia.slice(0, MAX_STYLE_MEDIA))}
      />
    </div>
  );
}

export default function AdminOpsStyles() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.styles;
  const ui = editorCopy(locale);
  const styles = listOpsStyles();
  const specs = listStyleSpecs();
  const settings = getSettings();
  const [draft, setDraft] = useState(() => newDraftForCategory("ring"));
  const [copyDraft, setCopyDraft] = useState(() => catalogCopyDraft(settings));
  const [sp, setSp] = useState({ styleId: "", metal: "18kw", size: "", centerStoneSpec: "", estWeightG: "", variancePct: 6, laborUsd: "", materialsUsd: "" });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editorLocale, setEditorLocale] = useState(locale || "en");
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });
  const selected = useMemo(() => styles.find((style) => style.id === draft.id) || null, [draft.id, styles]);
  const isEditing = Boolean(draft.id);
  const filteredStyles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return styles.filter((style) => {
      if (categoryFilter !== "all" && style.category !== categoryFilter) return false;
      if (!q) return true;
      return [style.id, ...Object.values(style.name || {})].join(" ").toLowerCase().includes(q);
    });
  }, [categoryFilter, query, styles]);
  const stats = useMemo(() => ({
    total: styles.length,
    published: styles.filter((style) => style.published).length,
    sale: styles.filter((style) => style.availableForSale).length,
    media: styles.filter((style) => mediaCountLabel(style) > 0).length,
  }), [styles]);
  const currentStyleTitle = draft.nameEn || draft.nameKo || draft.nameZh || draft.nameEs || ui.untitled;

  function setDraftField(patch) {
    setDraft((current) => ({ ...current, ...patch }));
    if (saveState.status !== "idle") setSaveState({ status: "idle", message: "" });
  }

  function startNewStyle() {
    setDraft(newDraftForCategory(categoryFilter));
    setSaveState({ status: "idle", message: "" });
  }

  function setCopyField(copyLocale, key, value) {
    setCopyDraft((current) => ({
      ...current,
      [copyLocale]: { ...current[copyLocale], [key]: value },
    }));
  }

  function submitStyle(e) {
    e.preventDefault();
    const wasEditing = Boolean(draft.id);
    setSaveState({ status: "saving", message: ui.savingStyle });
    try {
      const saved = saveOpsStyle(styleFromDraft(draft));
      pushStyleToServer(saved); // 서버가 진실 — 고객 카탈로그에 반영
      setDraft(draftFromStyle(saved));
      setSaveState({ status: "saved", message: wasEditing ? ui.savedStyle : ui.addedStyle });
    } catch (error) {
      setSaveState({ status: "error", message: ui.saveFailed });
      throw error;
    }
  }

  function saveCatalogCopy() {
    updateSettings({ designCopy: copyDraft });
    pushSettingsToServer({ designCopy: copyDraft });
    setSaveState({ status: "saved", message: ui.catalogSaved });
  }

  function toggleStyleField(style, patch) {
    try {
      const saved = saveOpsStyle({ id: style.id, ...patch });
      pushStyleToServer(saved);
      if (draft.id === saved.id) setDraft(draftFromStyle(saved));
      setSaveState({ status: "saved", message: ui.savedStyle });
    } catch (error) {
      setSaveState({ status: "error", message: ui.saveFailed });
      throw error;
    }
  }

  function removeStyle(style) {
    if (!confirm(ui.deleteConfirm(style.id))) return;
    deleteOpsStyle(style.id);
    deleteStyleOnServer(style.id);
    if (draft.id === style.id) setDraft(newDraftForCategory(categoryFilter));
    setSaveState({ status: "saved", message: ui.deletedStyle });
  }

  function submitSpec() {
    saveStyleSpec({
      ...sp,
      estWeightG: Number(sp.estWeightG),
      variancePct: Number(sp.variancePct),
      laborUsd: Number(sp.laborUsd),
      materialsUsd: Number(sp.materialsUsd) || 0,
    });
    setSp({ styleId: sp.styleId, metal: "18kw", size: "", centerStoneSpec: "", estWeightG: "", variancePct: 6, laborUsd: "", materialsUsd: "" });
    pushSettingsToServer({ styleSpecs: listStyleSpecs() });
    setSaveState({ status: "saved", message: ui.specSaved });
  }

  function removeSpec(id) {
    deleteStyleSpec(id);
    pushSettingsToServer({ styleSpecs: listStyleSpecs() });
    setSaveState({ status: "saved", message: ui.specDeleted });
  }

  return (
    <>
      <ConsoleHead kicker={ui.kicker} title={t.title} sub={ui.sub}>
        <button className="button primary small" type="button" onClick={startNewStyle}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {ui.newStyle}
        </button>
      </ConsoleHead>

      <StatStrip
        stats={[
          { value: stats.total, label: ui.statStyles },
          { value: stats.published, label: ui.published },
          { value: stats.sale, label: ui.forSaleShort },
          { value: stats.media, label: ui.media },
        ]}
      />

      <div className="con-workbench">
        <section className="con-list" aria-label={ui.library}>
          <div className="con-list-tools">
            <div className="con-search">
              <Search size={14} strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder={ui.searchPh}
                aria-label={ui.searchPh}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="con-filters" aria-label={p.admin.tpl.category}>
              <button type="button" className={categoryFilter === "all" ? "is-active" : ""} onClick={() => setCategoryFilter("all")}>
                {ui.categoryAll}
              </button>
              {Object.entries(p.opsCategories).map(([key, label]) => (
                <button type="button" key={key} className={categoryFilter === key ? "is-active" : ""} onClick={() => setCategoryFilter(key)}>
                  {label}
                </button>
              ))}
              <span className="con-count">{ui.countLabel(filteredStyles.length)}</span>
            </div>
          </div>

          <div className="con-list-scroll">
            {filteredStyles.length === 0 && <p className="con-empty">{ui.emptyList}</p>}
            {filteredStyles.map((st) => {
              const active = draft.id === st.id;
              const media = mediaFromStyle(st);
              return (
                <article className={`con-row ${active ? "is-selected" : ""}`} key={st.id}>
                  <button type="button" className="con-row-main" onClick={() => setDraft(draftFromStyle(st))}>
                    <span className="con-row-thumb">
                      <MediaThumb media={media[0] || { kind: "image", src: FALLBACK_MEDIA }} alt={pickI18n(st.name, locale)} />
                    </span>
                    <span className="con-row-copy">
                      <strong>{pickI18n(st.name, locale)}</strong>
                      <small>
                        {p.opsSubcategories?.[styleSubcategoryKey(st)] || styleSubcategoryKey(st)}
                        {" · "}{st.id}{" · "}{media.length}/5{" · "}{st.leadDays || 0}d
                      </small>
                    </span>
                  </button>
                  <div className="con-row-side">
                    <button
                      type="button"
                      className={`con-pill ${st.availableForSale ? "is-on" : ""}`}
                      aria-pressed={st.availableForSale}
                      title={t.available}
                      onClick={() => toggleStyleField(st, { availableForSale: !st.availableForSale })}
                    >
                      <i aria-hidden="true" />
                      {st.availableForSale ? ui.forSaleShort : ui.draftShort}
                    </button>
                    <button
                      type="button"
                      className={`con-pill ${st.published ? "is-on" : ""}`}
                      aria-pressed={st.published}
                      title={t.published}
                      onClick={() => toggleStyleField(st, { published: !st.published })}
                    >
                      <i aria-hidden="true" />
                      {st.published ? ui.published : ui.hidden}
                    </button>
                    <button type="button" className="con-row-delete" aria-label={`${p.common.delete} ${st.id}`} onClick={() => removeStyle(st)}>
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <form className="con-editor" onSubmit={submitStyle}>
          <header className="con-editor-head">
            <div>
              <p className="con-kicker">{isEditing ? ui.editStyle : ui.draftStyle}</p>
              <h3>{currentStyleTitle}</h3>
              <p className="con-editor-meta">{isEditing ? `${draft.id} · ${ui.mediaCount(mediaFromStyle(selected).length)}` : ui.autoId}</p>
            </div>
            {isEditing && (
              <button className="button secondary small" type="button" onClick={startNewStyle}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                {ui.newStyle}
              </button>
            )}
          </header>

          <section className="con-section">
            <div className="con-section-head">
              <span className="con-section-num">01</span>
              <h4>{ui.basics}</h4>
              <span className="con-section-aside">{ui.status}</span>
            </div>
            <div className="con-grid con-grid-basics">
              <label className="field"><span>{p.admin.tpl.category}</span>
                <select
                  value={draft.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    setDraftField({ category, subcategory: defaultSubcategoryFor(category) });
                  }}
                >
                  {Object.entries(p.opsCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field"><span>{t.subcategory}</span>
                <select value={draft.subcategory} onChange={(e) => setDraftField({ subcategory: e.target.value })}>
                  {subcategoryKeysFor(draft.category).map((key) => (
                    <option key={key} value={key}>{p.opsSubcategories?.[key] || key}</option>
                  ))}
                </select>
              </label>
              <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={draft.estWeightG} onChange={(e) => setDraftField({ estWeightG: e.target.value })} required /></label>
              <label className="field"><span>{t.labor}</span><input type="number" value={draft.laborUsd} onChange={(e) => setDraftField({ laborUsd: e.target.value })} required /></label>
              <label className="field"><span>{t.leadDays}</span><input type="number" value={draft.leadDays} onChange={(e) => setDraftField({ leadDays: e.target.value })} required /></label>
            </div>
            <div className="con-switch-row">
              <label className={`con-switch ${draft.availableForSale ? "is-on" : ""}`}>
                <input type="checkbox" checked={draft.availableForSale} onChange={(e) => setDraftField({ availableForSale: e.target.checked })} />
                <span className="con-switch-track" aria-hidden="true" />
                <span className="con-switch-copy">
                  <strong>{t.available}</strong>
                  <small>{ui.readyForSale}</small>
                </span>
              </label>
              <label className={`con-switch ${draft.published ? "is-on" : ""}`}>
                <input type="checkbox" checked={draft.published} onChange={(e) => setDraftField({ published: e.target.checked })} />
                <span className="con-switch-track" aria-hidden="true" />
                <span className="con-switch-copy">
                  <strong>{t.published}</strong>
                  <small>{draft.published ? ui.published : ui.hidden}</small>
                </span>
              </label>
            </div>
          </section>

          <section className="con-section">
            <div className="con-section-head">
              <span className="con-section-num">02</span>
              <h4>{ui.names}</h4>
              <span className="con-section-aside">EN / KO / ZH / ES</span>
            </div>
            <div className="con-grid con-grid-2">
              <label className="field"><span>Name EN</span><input value={draft.nameEn} onChange={(e) => setDraftField({ nameEn: e.target.value })} required /></label>
              <label className="field"><span>Name KO</span><input value={draft.nameKo} onChange={(e) => setDraftField({ nameKo: e.target.value })} /></label>
              <label className="field"><span>Name ZH</span><input value={draft.nameZh} onChange={(e) => setDraftField({ nameZh: e.target.value })} /></label>
              <label className="field"><span>Name ES</span><input value={draft.nameEs} onChange={(e) => setDraftField({ nameEs: e.target.value })} /></label>
            </div>
          </section>

          <section className="con-section">
            <div className="con-section-head">
              <span className="con-section-num">03</span>
              <h4>{ui.media}</h4>
              <span className="con-section-aside">{ui.mediaCount(draft.media.length)}</span>
            </div>
            <StyleMediaManager media={draft.media} copy={ui} onChange={(media) => setDraftField({ media })} />
          </section>

          <section className="con-section">
            <div className="con-section-head">
              <span className="con-section-num">04</span>
              <h4>{ui.publicText}</h4>
              <div className="admin-locale-tabs">
                {STYLE_LOCALES.map(({ key, label }) => (
                  <button type="button" key={key} className={editorLocale === key ? "is-active" : ""} onClick={() => setEditorLocale(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="con-grid con-grid-2">
              <label className="field"><span>Detail eyebrow</span>
                <input
                  value={draft[fieldName("label", editorLocale)] || ""}
                  placeholder={opsStrings[editorLocale]?.styleDetail?.label || ""}
                  onChange={(e) => setDraftField({ [fieldName("label", editorLocale)]: e.target.value })}
                />
              </label>
              <label className="field field-wide"><span>Detail intro</span>
                <textarea
                  value={draft[fieldName("intro", editorLocale)] || ""}
                  placeholder={opsStrings[editorLocale]?.styleDetail?.intro || ""}
                  onChange={(e) => setDraftField({ [fieldName("intro", editorLocale)]: e.target.value })}
                />
              </label>
              <label className="field"><span>Flexible row value</span>
                <input
                  value={draft[fieldName("flexible", editorLocale)] || ""}
                  placeholder={opsStrings[editorLocale]?.styleDetail?.flexibleValue || ""}
                  onChange={(e) => setDraftField({ [fieldName("flexible", editorLocale)]: e.target.value })}
                />
              </label>
              <label className="field"><span>Before production row value</span>
                <input
                  value={draft[fieldName("before", editorLocale)] || ""}
                  placeholder={opsStrings[editorLocale]?.styleDetail?.beforeProductionValue || ""}
                  onChange={(e) => setDraftField({ [fieldName("before", editorLocale)]: e.target.value })}
                />
              </label>
            </div>
          </section>

          <footer className="con-savebar">
            <div
              className={`admin-save-notice ${saveState.status !== "idle" ? `is-${saveState.status}` : ""}`}
              aria-live="polite"
              role="status"
            >
              {saveState.message}
            </div>
            <button className="button primary" type="submit" disabled={saveState.status === "saving"}>
              {saveState.status === "saving" ? ui.savingStyle : isEditing ? ui.saveStyle : ui.addStyle}
            </button>
          </footer>
        </form>
      </div>

      <details className="panel form-stack admin-collapsible-panel">
        <summary>
          <div>
            <h3>{ui.advancedCopy}</h3>
            <p className="form-hint">{ui.advancedCopyHint}</p>
          </div>
          <span>{t.save}</span>
        </summary>
        <div className="admin-copy-locale-stack">
          {STYLE_LOCALES.map(({ key, label }) => (
            <section className="admin-copy-locale" key={key}>
              <h4>{label}</h4>
              <div className="filter-grid admin-locale-grid">
                <label className="field"><span>Kicker</span><input value={copyDraft[key]?.kicker || ""} onChange={(e) => setCopyField(key, "kicker", e.target.value)} /></label>
                <label className="field"><span>Headline</span><input value={copyDraft[key]?.heroTitle || ""} onChange={(e) => setCopyField(key, "heroTitle", e.target.value)} /></label>
                <label className="field field-wide"><span>Sub copy</span><textarea value={copyDraft[key]?.sub || ""} onChange={(e) => setCopyField(key, "sub", e.target.value)} /></label>
                <label className="field field-wide"><span>Category note</span><input value={copyDraft[key]?.categoryNote || ""} onChange={(e) => setCopyField(key, "categoryNote", e.target.value)} /></label>
              </div>
            </section>
          ))}
        </div>
        <button className="button secondary small" type="button" onClick={saveCatalogCopy}>{t.save}</button>
      </details>

      <details className="panel form-stack admin-collapsible-panel">
        <summary>
          <div>
            <h3>{ui.specsTitle} ({specs.length})</h3>
            <p className="form-hint">{ui.specsHint}</p>
          </div>
          <span>{t.newSpec}</span>
        </summary>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Style</th><th>{p.intake.metal}</th><th>Size</th><th>{t.combo}</th><th>{t.estW}</th><th>{t.variance}</th><th>{t.labor}</th><th>{t.materials}</th><th /></tr>
            </thead>
            <tbody>
              {specs.map((s) => (
                <tr key={s.id}>
                  <td>{s.styleId}</td>
                  <td>{p.opsMetals[s.metal] || s.metal}</td>
                  <td>{s.size || "—"}</td>
                  <td>{s.centerStoneSpec || "—"}</td>
                  <td>{s.estWeightG}g</td>
                  <td>±{s.variancePct}%</td>
                  <td>{usd(s.laborUsd)}</td>
                  <td>{usd(s.materialsUsd || 0)}</td>
                  <td><button className="button danger small" type="button" onClick={() => removeSpec(s.id)}>{p.common.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 10 }}>{t.newSpec}</h3>
        <div className="filter-grid">
          <label className="field"><span>Style</span>
            <select value={sp.styleId} onChange={(e) => setSp({ ...sp, styleId: e.target.value })}>
              <option value="" disabled>—</option>
              {styles.map((st) => <option key={st.id} value={st.id}>{st.id}</option>)}
            </select></label>
          <label className="field"><span>{p.intake.metal}</span>
            <select value={sp.metal} onChange={(e) => setSp({ ...sp, metal: e.target.value })}>
              {Object.entries(p.opsMetals).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>Size</span><input value={sp.size} onChange={(e) => setSp({ ...sp, size: e.target.value })} /></label>
          <label className="field"><span>{t.combo}</span><input value={sp.centerStoneSpec} onChange={(e) => setSp({ ...sp, centerStoneSpec: e.target.value })} /></label>
          <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={sp.estWeightG} onChange={(e) => setSp({ ...sp, estWeightG: e.target.value })} /></label>
          <label className="field"><span>{t.variance}</span><input type="number" value={sp.variancePct} onChange={(e) => setSp({ ...sp, variancePct: e.target.value })} /></label>
          <label className="field"><span>{t.labor}</span><input type="number" value={sp.laborUsd} onChange={(e) => setSp({ ...sp, laborUsd: e.target.value })} /></label>
          <label className="field"><span>{t.materials}</span><input type="number" value={sp.materialsUsd} onChange={(e) => setSp({ ...sp, materialsUsd: e.target.value })} /></label>
        </div>
        <button className="button secondary small" type="button" disabled={!sp.styleId} onClick={submitSpec}>
          {p.common.add}
        </button>
      </details>
    </>
  );
}
