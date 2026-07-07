// 대화 속 첨부 — 작은 썸네일만 보여주고, 클릭하면 새 탭에서 원본. 원본을 인라인으로 크게 띄우지 않는다.
export default function ChatThumb({ a }) {
  if (!a?.url) return null;
  const isVideo = String(a.contentType || "").startsWith("video/");
  return (
    <a
      className="chat-thumb-link" href={a.url} target="_blank" rel="noopener noreferrer"
      title={a.name || "attachment"}
    >
      {isVideo
        ? <video className="chat-thumb" src={a.url} muted preload="metadata" />
        : <img className="chat-thumb" src={a.url} alt={a.name || "attachment"} loading="lazy" />}
      {isVideo && <span className="chat-thumb-play" aria-hidden="true">▶</span>}
    </a>
  );
}
