import { useState, useSyncExternalStore } from "react";
import { useLocale } from "../../i18n.jsx";
import { MediaPicker, withBase } from "../../components/ui.jsx";
import { getSettings, subscribe, updateSettings } from "../../lib/store.js";
import { apiFetch } from "../../lib/api.js";
import { ConsoleHead } from "./console.jsx";

const HERO_VIDEO_DEFAULT = "/assets/hero-v2.mp4";
const HERO_POSTER_DEFAULT = "/assets/hero-v2-poster.jpg";
const resolveAsset = (url) => (/^https?:\/\//i.test(url || "") ? url : withBase(url));

const formatMB = (bytes) => (bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "");

const STR = {
  en: {
    menu: "Hero video", title: "Home hero video.", sub: "The looping background at the top of the homepage.",
    liveTitle: "Currently live", live: "Live",
    uploadTitle: "Replace it", uploadHint: "Drop a web-ready MP4 below — ideally 1080p (1920×1080), muted, ≤30MB. A still frame is captured automatically for the poster.",
    uploading: "Uploading video…",
    stagedTitle: "New video — preview", stagedBadge: "Not live yet",
    stagedNote: "This is a preview. Your homepage will not change until you publish it.",
    publish: "Publish to homepage", discard: "Discard", reset: "Reset to default video",
    saving: "Publishing…", saved: "Hero video is now live", saveFailed: "Could not save to the server. The current hero video is unchanged.",
  },
  ko: {
    menu: "히어로 영상", title: "홈 히어로 영상.", sub: "홈페이지 상단에서 반복 재생되는 배경 영상입니다.",
    liveTitle: "현재 라이브", live: "라이브",
    uploadTitle: "새 영상으로 교체", uploadHint: "아래에 웹용 MP4를 드롭하세요 — 1080p(1920×1080)·무음·30MB 이하 권장. 포스터(첫 프레임)는 자동으로 만들어집니다.",
    uploading: "영상 업로드 중…",
    stagedTitle: "새 영상 — 미리보기", stagedBadge: "아직 공개 안 됨",
    stagedNote: "미리보기 상태입니다. '홈에 게시'를 눌러야 실제 홈페이지가 바뀝니다.",
    publish: "홈에 게시", discard: "취소", reset: "기본 영상으로 되돌리기",
    saving: "게시 중…", saved: "히어로 영상이 라이브에 반영되었습니다", saveFailed: "서버에 저장하지 못했습니다. 현재 히어로 영상이 그대로 유지됩니다.",
  },
  zh: {
    menu: "首页视频", title: "首页 Hero 视频。", sub: "首页顶部循环播放的背景视频。",
    liveTitle: "当前生效", live: "生效中",
    uploadTitle: "更换视频", uploadHint: "在下方拖入适合网页的 MP4 —— 建议 1080p（1920×1080）、静音、不超过 30MB。海报帧会自动生成。",
    uploading: "正在上传视频…",
    stagedTitle: "新视频 — 预览", stagedBadge: "尚未上线",
    stagedNote: "这是预览。点击“发布到首页”后首页才会更改。",
    publish: "发布到首页", discard: "放弃", reset: "恢复默认视频",
    saving: "发布中…", saved: "Hero 视频已上线", saveFailed: "无法保存到服务器，当前 Hero 视频保持不变。",
  },
  es: {
    menu: "Video hero", title: "Video hero del inicio.", sub: "El fondo en bucle en la parte superior de la página de inicio.",
    liveTitle: "En vivo ahora", live: "En vivo",
    uploadTitle: "Reemplazarlo", uploadHint: "Suelta abajo un MP4 listo para web — idealmente 1080p (1920×1080), silenciado, ≤30MB. El póster se captura automáticamente.",
    uploading: "Subiendo video…",
    stagedTitle: "Nuevo video — vista previa", stagedBadge: "Aún no publicado",
    stagedNote: "Esto es una vista previa. Tu página de inicio no cambiará hasta que lo publiques.",
    publish: "Publicar en el inicio", discard: "Descartar", reset: "Restablecer al video predeterminado",
    saving: "Publicando…", saved: "El video hero ya está en vivo", saveFailed: "No se pudo guardar en el servidor. El video hero actual no cambió.",
  },
};

export default function AdminHero() {
  const { locale } = useLocale();
  const c = STR[locale] || STR.en;
  // 현재 라이브 영상은 스토어 구독 — 게시 직후 즉시 카드에 반영된다
  const currentVideo = useSyncExternalStore(subscribe, () => getSettings()?.heroVideo || HERO_VIDEO_DEFAULT);
  const currentPoster = useSyncExternalStore(subscribe, () => getSettings()?.heroPoster || HERO_POSTER_DEFAULT);

  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // R2 업로드가 끝나 재생 가능한 원격 영상만 "게시 준비됨"으로 취급 (transient=업로드 실패 로컬 blob)
  const staged = items.find((m) => m?.kind === "video" && m?.src && !m.transient);

  async function save(video, poster) {
    if (saving) return;
    setSaving(true); setNotice(""); setError("");
    const patch = { heroVideo: video, heroPoster: poster || video };
    try {
      await apiFetch("/admin/settings", { method: "PUT", body: patch });
      updateSettings(patch);
      setItems([]);
      setNotice(c.saved);
    } catch {
      setError(c.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ConsoleHead kicker={c.menu} title={c.title} sub={c.sub}>
        {saving ? <span className="con-saved-flash" role="status">{c.saving}</span> : notice && <span className="con-saved-flash" role="status">{notice}</span>}
      </ConsoleHead>

      {error && <p className="admin-save-notice is-error" role="alert">{error}</p>}

      <div className="con-table-panel con-narrow hero-admin" style={{ padding: "18px 18px 22px" }}>
        {/* 현재 라이브 */}
        <div className="hero-admin-card">
          <div className="hero-admin-card-head">
            <h3>{c.liveTitle}</h3>
            <span className="hero-admin-badge is-live">{c.live}</span>
          </div>
          <video
            className="hero-admin-video"
            src={resolveAsset(currentVideo)}
            poster={resolveAsset(currentPoster)}
            muted loop playsInline autoPlay preload="metadata"
          />
          <p className="con-note hero-admin-path">{currentVideo}</p>
        </div>

        {/* 교체 */}
        <div className="con-section-label" style={{ marginTop: 26 }}><h3>{c.uploadTitle}</h3></div>
        <p className="con-note" style={{ margin: "0 0 12px" }}>{c.uploadHint}</p>

        {!staged && (
          <MediaPicker
            value={items}
            onChange={setItems}
            onBusyChange={setUploading}
            maxItems={1}
            scope="hero"
            remoteRequired
            showSamples={false}
            previewMode="none"
          />
        )}
        {uploading && <p className="con-note hero-admin-uploading" role="status">{c.uploading}</p>}

        {/* 스테이징된 새 영상 — 실제 미리보기 + 게시/취소 */}
        {staged && (
          <div className="hero-admin-card is-staged">
            <div className="hero-admin-card-head">
              <h3>{c.stagedTitle}</h3>
              <span className="hero-admin-badge is-staged">{c.stagedBadge}</span>
            </div>
            <video
              className="hero-admin-video"
              key={staged.src}
              src={resolveAsset(staged.src)}
              poster={staged.poster ? resolveAsset(staged.poster) : undefined}
              muted loop playsInline autoPlay preload="metadata"
            />
            <p className="con-note hero-admin-path">
              {[staged.name, formatMB(staged.size)].filter(Boolean).join(" · ")}
            </p>
            <p className="con-note" style={{ marginTop: 4 }}>{c.stagedNote}</p>
            <div className="hero-admin-actions">
              <button className="button primary" type="button" disabled={saving} onClick={() => save(staged.src, staged.poster)}>
                {saving ? c.saving : c.publish}
              </button>
              <button className="button secondary small" type="button" disabled={saving} onClick={() => setItems([])}>
                {c.discard}
              </button>
            </div>
          </div>
        )}

        {/* 기본값 복구 — 스테이징 중이 아닐 때만 노출 */}
        {!staged && (
          <div className="hero-admin-actions" style={{ marginTop: 18 }}>
            <button className="button secondary small" type="button" disabled={saving} onClick={() => save(HERO_VIDEO_DEFAULT, HERO_POSTER_DEFAULT)}>
              {c.reset}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
