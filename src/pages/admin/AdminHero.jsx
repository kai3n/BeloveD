import { useState } from "react";
import { useLocale } from "../../i18n.jsx";
import { MediaPicker, withBase } from "../../components/ui.jsx";
import { getSettings, updateSettings } from "../../lib/store.js";
import { apiFetch } from "../../lib/api.js";
import { ConsoleHead } from "./console.jsx";

const HERO_VIDEO_DEFAULT = "/assets/hero-v2.mp4";
const HERO_POSTER_DEFAULT = "/assets/hero-v2-poster.jpg";
const resolveAsset = (url) => (/^https?:\/\//i.test(url || "") ? url : withBase(url));

const STR = {
  en: {
    menu: "Hero video", title: "Home hero video.", sub: "The looping background on the homepage.",
    currentTitle: "Currently live", uploadTitle: "Replace hero video",
    uploadHint: "Upload a web-ready MP4 — ideally 1080p (1920×1080), muted, ≤30MB. A poster frame is captured automatically.",
    apply: "Set as hero video", reset: "Reset to default", saving: "Saving…", saved: "Hero video updated",
    saveFailed: "Could not save to the server. The current hero video is unchanged.",
  },
  ko: {
    menu: "히어로 영상", title: "홈 히어로 영상.", sub: "홈페이지 상단에서 반복 재생되는 배경 영상입니다.",
    currentTitle: "현재 적용됨", uploadTitle: "히어로 영상 교체",
    uploadHint: "웹용 MP4를 올려주세요 — 1080p(1920×1080), 무음, 30MB 이하 권장. 포스터(첫 프레임)는 자동으로 만들어집니다.",
    apply: "히어로 영상으로 설정", reset: "기본 영상으로 되돌리기", saving: "저장 중…", saved: "히어로 영상이 변경되었습니다",
    saveFailed: "서버에 저장하지 못했습니다. 현재 히어로 영상이 그대로 유지됩니다.",
  },
  zh: {
    menu: "首页视频", title: "首页 Hero 视频。", sub: "首页顶部循环播放的背景视频。",
    currentTitle: "当前生效", uploadTitle: "更换 Hero 视频",
    uploadHint: "请上传适合网页的 MP4 —— 建议 1080p（1920×1080）、静音、不超过 30MB。海报帧会自动生成。",
    apply: "设为 Hero 视频", reset: "恢复默认视频", saving: "保存中…", saved: "Hero 视频已更新",
    saveFailed: "无法保存到服务器，当前 Hero 视频保持不变。",
  },
  es: {
    menu: "Video hero", title: "Video hero del inicio.", sub: "El fondo en bucle de la página de inicio.",
    currentTitle: "En vivo ahora", uploadTitle: "Reemplazar video hero",
    uploadHint: "Sube un MP4 listo para web — idealmente 1080p (1920×1080), silenciado, ≤30MB. El póster se captura automáticamente.",
    apply: "Usar como video hero", reset: "Restablecer al predeterminado", saving: "Guardando…", saved: "Video hero actualizado",
    saveFailed: "No se pudo guardar en el servidor. El video hero actual no cambió.",
  },
};

export default function AdminHero() {
  const { locale } = useLocale();
  const c = STR[locale] || STR.en;
  const settings = getSettings() || {};
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentVideo = settings.heroVideo || HERO_VIDEO_DEFAULT;
  const currentPoster = settings.heroPoster || HERO_POSTER_DEFAULT;
  const uploaded = items.find((m) => m?.src);

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

      <div className="con-table-panel con-narrow" style={{ padding: "18px 18px 22px" }}>
        <div className="con-section-label"><h3>{c.currentTitle}</h3></div>
        <video
          src={resolveAsset(currentVideo)}
          poster={resolveAsset(currentPoster)}
          muted
          loop
          playsInline
          autoPlay
          style={{ width: "100%", maxWidth: 560, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10, background: "#000", display: "block" }}
        />
        <p className="con-note" style={{ marginTop: 8, wordBreak: "break-all" }}>{currentVideo}</p>

        <div className="con-section-label" style={{ marginTop: 24 }}><h3>{c.uploadTitle}</h3></div>
        <p className="con-note" style={{ marginBottom: 12 }}>{c.uploadHint}</p>
        <MediaPicker
          value={items}
          onChange={setItems}
          maxItems={1}
          scope="hero"
          remoteRequired
          showSamples={false}
          previewMode="list"
        />
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {uploaded?.src && (
            <button className="button primary" type="button" disabled={saving} onClick={() => save(uploaded.src, uploaded.poster)}>
              {c.apply}
            </button>
          )}
          <button className="button secondary small" type="button" disabled={saving} onClick={() => save(HERO_VIDEO_DEFAULT, HERO_POSTER_DEFAULT)}>
            {c.reset}
          </button>
        </div>
      </div>
    </>
  );
}
