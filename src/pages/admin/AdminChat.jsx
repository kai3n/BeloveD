import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { apiFetch, uploadMedia } from "../../lib/api.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";
import "../../chat.css";

// 라이브챗 인박스 — 스레드 목록 | 대화 | 컨텍스트. 실서버(/v1/admin/chat) 폴링.
const COPY = {
  en: { title: "Messages", sub: "Live chat from the site. Reply here — visitors see it instantly; offline ones get an email.", open: "Open", all: "All", guest: "Guest", empty: "Select a conversation.", none: "No conversations yet.", placeholder: "Type a reply…  (Enter to send)", close: "Close", reopen: "Reopen", customer: "Customer", orders: "Orders", activity: "Recent activity", since: "since", noEmail: "no email on file" },
  ko: { title: "메시지", sub: "사이트 라이브챗. 여기서 답장하면 방문자에게 즉시 표시되고, 오프라인이면 이메일로도 갑니다.", open: "진행중", all: "전체", guest: "방문자", empty: "대화를 선택하세요.", none: "아직 대화가 없어요.", placeholder: "답장 입력…  (Enter 전송)", close: "종료", reopen: "다시 열기", customer: "고객", orders: "주문", activity: "최근 활동", since: "가입", noEmail: "이메일 없음" },
  zh: { title: "消息", sub: "网站在线聊天。在此回复，访客即时可见；离线访客会收到邮件。", open: "进行中", all: "全部", guest: "访客", empty: "选择一个对话。", none: "还没有对话。", placeholder: "输入回复…（Enter 发送）", close: "关闭", reopen: "重新打开", customer: "客户", orders: "订单", activity: "近期活动", since: "注册", noEmail: "无邮箱" },
  es: { title: "Mensajes", sub: "Chat en vivo del sitio. Responde aquí — los visitantes lo ven al instante; los desconectados reciben un correo.", open: "Abierto", all: "Todos", guest: "Visitante", empty: "Selecciona una conversación.", none: "Aún no hay conversaciones.", placeholder: "Escribe una respuesta…  (Enter para enviar)", close: "Cerrar", reopen: "Reabrir", customer: "Cliente", orders: "Pedidos", activity: "Actividad reciente", since: "desde", noEmail: "sin correo" },
};

const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const ymd = (iso) => { try { return new Date(iso).toLocaleDateString(); } catch { return ""; } };

export default function AdminChat() {
  const { locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const [status, setStatus] = useState("open");
  const [threads, setThreads] = useState([]);
  const [activeCode, setActiveCode] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const lastIdRef = useRef(0);
  const threadBodyRef = useRef(null);
  const fileRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const d = await apiFetch(`/admin/chat/threads?status=${status}`);
      setThreads(d.threads || []);
    } catch (e) { setError(e.code || e.message); }
  }, [status]);

  // 목록 폴링
  useEffect(() => {
    loadThreads();
    const id = window.setInterval(loadThreads, 8000);
    return () => window.clearInterval(id);
  }, [loadThreads]);

  const loadActive = useCallback(async () => {
    if (!activeCode) return;
    try {
      const d = await apiFetch(`/admin/chat/threads/${activeCode}?since=${lastIdRef.current}`);
      setThread(d.thread);
      setContext(d.context || null);
      if (d.messages?.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = d.messages.filter((m) => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh].sort((a, b) => a.id - b.id) : prev;
        });
        lastIdRef.current = Math.max(lastIdRef.current, ...d.messages.map((m) => m.id));
      }
    } catch (e) { setError(e.code || e.message); }
  }, [activeCode]);

  // 선택 스레드 폴링
  useEffect(() => {
    if (!activeCode) return undefined;
    lastIdRef.current = 0;
    setMessages([]);
    loadActive();
    const id = window.setInterval(loadActive, 4000);
    return () => window.clearInterval(id);
  }, [activeCode, loadActive]);

  useEffect(() => {
    if (threadBodyRef.current) threadBodyRef.current.scrollTop = threadBodyRef.current.scrollHeight;
  }, [messages]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true); setError("");
    try {
      const url = await uploadMedia(file, { scope: "chat", contentType: file.type });
      setPending((p) => [...p, { url, contentType: file.type, name: file.name }]);
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  }

  async function send() {
    const body = input.trim();
    if ((!body && pending.length === 0) || sending || !activeCode) return;
    setSending(true); setError("");
    try {
      await apiFetch(`/admin/chat/threads/${activeCode}/messages`, { method: "POST", body: { body, attachments: pending } });
      setInput(""); setPending([]);
      await loadActive();
      loadThreads();
    } catch (e) { setError(e.code || e.message); }
    finally { setSending(false); }
  }

  async function toggleStatus() {
    if (!thread) return;
    const next = thread.status === "open" ? "closed" : "open";
    try {
      await apiFetch(`/admin/chat/threads/${activeCode}/status`, { method: "POST", body: { status: next } });
      await loadActive(); loadThreads();
    } catch (e) { setError(e.code || e.message); }
  }

  const nameOf = (t) => t.customerName || (t.visitorEmail ? t.visitorEmail : `${c.guest} · ${t.code.replace("CHAT-", "#")}`);

  return (
    <>
      <ConsoleHead kicker="Live chat" title={c.title} sub={c.sub} />
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="achat">
        <div className="achat-list">
          <div className="achat-filter">
            {["open", "all"].map((s) => (
              <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
                {s === "open" ? c.open : c.all}
              </button>
            ))}
          </div>
          {threads.length === 0 && <p className="form-hint" style={{ padding: 14 }}>{c.none}</p>}
          {threads.map((t) => (
            <div key={t.code} className={`achat-item ${t.code === activeCode ? "active" : ""}`} onClick={() => setActiveCode(t.code)}>
              <div className="achat-item-main">
                <div className="achat-item-top">
                  <span className="achat-item-name">{nameOf(t)}</span>
                  <span className="achat-item-time">{hhmm(t.lastMessageAt)}</span>
                </div>
                <div className="achat-item-preview">{t.lastSender === "staff" ? "↩ " : ""}{t.preview || "—"}</div>
              </div>
              {t.staffUnread > 0 && <span className="achat-unread">{t.staffUnread}</span>}
            </div>
          ))}
        </div>

        <div className="achat-conv">
          {!activeCode ? (
            <div className="achat-empty">{c.empty}</div>
          ) : (
            <>
              <div className="achat-conv-head">
                <strong>{context?.customer?.name || thread?.visitorEmail || `${c.guest} · ${activeCode.replace("CHAT-", "#")}`}</strong>
                <button className="button secondary small" onClick={toggleStatus}>
                  {thread?.status === "open" ? c.close : c.reopen}
                </button>
              </div>
              <div className="achat-thread" ref={threadBodyRef}>
                {messages.map((m) => (
                  <div key={m.id} className={`achat-msg ${m.sender}`}>
                    {m.body && <span>{m.body}</span>}
                    {(m.attachments || []).map((a, i) => <img key={i} src={a.url} alt={a.name || "attachment"} loading="lazy" />)}
                    {m.sender !== "system" && <span className="achat-msg-time">{hhmm(m.createdAt)}</span>}
                  </div>
                ))}
              </div>
              <div className="achat-composer">
                <button className="chat-attach" aria-label="Attach" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={18} strokeWidth={1.8} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
                {pending.length > 0 && <span className="form-hint">{pending.length} img</span>}
                <textarea rows={1} value={input} placeholder={c.placeholder}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button className="chat-send" aria-label="Send" disabled={sending || (!input.trim() && pending.length === 0)} onClick={send}>
                  <Send size={17} strokeWidth={1.9} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="achat-ctx">
          {context?.customer ? (
            <>
              <h4>{c.customer}</h4>
              <div className="row"><span>{context.customer.name}</span></div>
              <div className="row"><span className="muted">{context.customer.email}</span></div>
              <div className="row"><span className="muted">{c.since} {ymd(context.customer.since)}</span></div>
            </>
          ) : (
            <><h4>{c.customer}</h4><p className="muted">{thread?.visitorEmail || c.guest} · {thread?.visitorEmail ? "" : c.noEmail}</p></>
          )}
          {context?.orders?.length > 0 && (
            <>
              <h4>{c.orders}</h4>
              {context.orders.map((o) => <div className="row" key={o.orderCode}><span>{o.orderCode}</span><span className="muted">{o.stage}</span></div>)}
            </>
          )}
          {context?.activity?.length > 0 && (
            <>
              <h4>{c.activity}</h4>
              {context.activity.slice(0, 8).map((a, i) => <div className="row" key={i}><span className="muted">{a.type}</span><span className="muted">{a.entityId || ""}</span></div>)}
            </>
          )}
        </div>
      </div>
    </>
  );
}
