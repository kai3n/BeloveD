import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ImagePlus, MessageCircle, Send, X } from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { fetchThread, sendChatMessage, uploadChatImage } from "../lib/chat.js";
import { faqChips } from "../lib/chatFaq.js";
import "../chat.css";

// 위젯을 숨길 경로 — 어드민 콘솔·스태프 게이트(같은 Layout 안에서 렌더되므로 여기서 차단)
const BLOCKED = (path) => path.startsWith("/bo-") || path.startsWith("/gate-") || path.startsWith("/admin");

const COPY = {
  en: {
    title: "Messages", open: "Chat with us",
    greeting: "Hi! Questions about a design, sizing, or an order? Our team usually replies within a few minutes.",
    placeholder: "Write a message…", email: "your@email.com — for a reply by email (optional)",
    powered: "BeloveD concierge",
  },
  ko: {
    title: "메시지", open: "문의하기",
    greeting: "안녕하세요! 디자인·사이즈·주문 관련 무엇이든 물어보세요. 보통 몇 분 안에 답장드려요.",
    placeholder: "메시지를 입력하세요…", email: "이메일 주소 — 이메일로도 답장받기 (선택)",
    powered: "BeloveD 컨시어지",
  },
  zh: {
    title: "消息", open: "在线咨询",
    greeting: "您好！关于设计、尺寸或订单有任何问题都可以问我们，通常几分钟内回复。",
    placeholder: "输入消息…", email: "您的邮箱 — 也可通过邮件回复（可选）",
    powered: "BeloveD 礼宾",
  },
  es: {
    title: "Mensajes", open: "Chatea con nosotros",
    greeting: "¡Hola! ¿Preguntas sobre un diseño, tallas o un pedido? Solemos responder en unos minutos.",
    placeholder: "Escribe un mensaje…", email: "tu@email.com — para responder por correo (opcional)",
    powered: "BeloveD concierge",
  },
};

function initials(name) {
  return String(name || "B").trim().slice(0, 1).toUpperCase();
}
function hhmm(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function Avatar({ agent, className = "" }) {
  if (agent?.avatar) return <img className={`chat-avatar ${className}`} src={agent.avatar} alt={agent.name} />;
  return <div className={`chat-avatar ${className}`} aria-hidden="true">{initials(agent?.name)}</div>;
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  const t = COPY[locale] || COPY.en;
  const chips = faqChips(locale);
  const hidden = BLOCKED(pathname);

  // 열림 상태를 세션에 유지 — 페이지 이동(위젯은 Layout에 상시 마운트)뿐 아니라
  // 새로고침에도 살아남는다. ?chat=open(이메일 CTA)이면 강제로 열림.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("chat") === "open") return true;
    try { return window.sessionStorage.getItem("bd_chat_open") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { window.sessionStorage.setItem("bd_chat_open", open ? "1" : "0"); } catch { /* no-op */ }
  }, [open]);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [agent, setAgent] = useState(null);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState([]); // 첨부 대기 [{url,contentType,name}]
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const lastIdRef = useRef(0);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);

  function ingest(data) {
    if (!data) return;
    if (data.staffAgent) setAgent(data.staffAgent);
    if (data.thread !== undefined) {
      setThread(data.thread);
      if (data.thread) setUnread(data.thread.customerUnread || 0);
    }
    if (data.messages?.length) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = data.messages.filter((m) => !seen.has(m.id));
        if (!fresh.length) return prev;
        return [...prev, ...fresh].sort((a, b) => a.id - b.id);
      });
      lastIdRef.current = Math.max(lastIdRef.current, ...data.messages.map((m) => m.id));
    }
  }

  // 폴링: 열림=3s(읽음처리), 닫힘=15s(peek, 미확인 뱃지만)
  useEffect(() => {
    if (hidden) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const data = await fetchThread({ since: lastIdRef.current, peek: !open });
        if (alive) ingest(data);
      } catch { /* 서버 부재·오프라인 — 조용히 무시 */ }
    };
    tick();
    const id = window.setInterval(tick, open ? 3000 : 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, [open, hidden]);

  // 열려 있고 새 메시지 오면 맨 아래로
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true); setError("");
    try {
      const url = await uploadChatImage(file, file.type);
      setPending((p) => [...p, { url, contentType: file.type, name: file.name }]);
    } catch { setError("Upload failed — try again."); }
    finally { setUploading(false); }
  }

  async function doSend(text) {
    const body = String(text || "").trim();
    if ((!body && pending.length === 0) || sending) return;
    setSending(true); setError("");
    try {
      const data = await sendChatMessage({ body, attachments: pending, locale, email: email.trim() || undefined });
      setPending([]);
      // 방문자 메시지 + (있으면) FAQ 자동응답을 즉시 반영 — 폴링에서도 dedup됨
      ingest({
        staffAgent: data.staffAgent, thread: data.thread,
        messages: [data.message, ...(data.autoReply ? [data.autoReply] : [])],
      });
    } catch { setError("Could not send — please try again."); }
    finally { setSending(false); }
  }

  function handleSend() {
    const body = input.trim();
    if (!body && pending.length === 0) return;
    setInput("");
    doSend(body);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  if (hidden) return null;

  const showEmail = !thread?.customerId && !thread?.visitorEmail;

  if (!open) {
    return (
      <div className="chat-root">
        <button className="chat-launcher" aria-label={t.open} onClick={() => setOpen(true)}>
          <MessageCircle size={26} strokeWidth={1.8} />
          {unread > 0 && <span className="chat-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="chat-root">
      <div className="chat-panel" role="dialog" aria-label={t.title}>
        <div className="chat-head">
          <Avatar agent={agent} />
          <div className="chat-head-meta">
            <div className="chat-head-name">{agent?.name || "BeloveD"}</div>
            <div className="chat-head-sub"><span className="chat-online-dot" />{agent?.title || t.powered}</div>
          </div>
          <button className="chat-icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={19} strokeWidth={1.9} />
          </button>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {messages.length === 0 ? (
            <div className="chat-greeting">
              <Avatar agent={agent} className="chat-greeting-avatar" />
              <div>{t.greeting}</div>
              <div className="chat-chips">
                {chips.map((c) => (
                  <button key={c.id} type="button" className="chat-chip" disabled={sending} onClick={() => doSend(c.label)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.sender}`}>
                {m.body && <span>{m.body}</span>}
                {(m.attachments || []).map((a, i) => (
                  <img key={i} src={a.url} alt={a.name || "attachment"} loading="lazy" />
                ))}
                {m.sender !== "system" && <span className="chat-msg-time">{hhmm(m.createdAt)}</span>}
              </div>
            ))
          )}
        </div>

        <div className="chat-foot">
          {error && <div className="chat-error">{error}</div>}
          {pending.length > 0 && (
            <div className="chat-attachments">
              {pending.map((a, i) => (
                <div className="chat-attachment" key={i}>
                  <img src={a.url} alt={a.name || "attachment"} />
                  <button aria-label="Remove" onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
          {showEmail && (
            <div className="chat-email-row">
              <input
                type="email" value={email} placeholder={t.email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          <div className="chat-composer">
            <button className="chat-attach" aria-label="Attach image" disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} strokeWidth={1.8} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
            <textarea
              rows={1} value={input} placeholder={t.placeholder}
              onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
            />
            <button className="chat-send" aria-label="Send" disabled={sending || (!input.trim() && pending.length === 0)}
              onClick={handleSend}>
              <Send size={17} strokeWidth={1.9} />
            </button>
          </div>
          <div className="chat-powered">✦ {t.powered}</div>
        </div>
      </div>
    </div>
  );
}
