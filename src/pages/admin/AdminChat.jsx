import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ImagePlus, MessageSquareText, Send, UserCheck } from "lucide-react";
import { apiFetch, uploadMedia } from "../../lib/api.js";
import { pushSupported, currentPushState, enablePush, disablePush } from "../../lib/push.js";
import { useLocale } from "../../i18n.jsx";
import ChatThumb from "../../components/ChatThumb.jsx";
import { ConsoleHead, StatStrip } from "./console.jsx";
import "../../chat.css";

// 라이브챗 인박스 — 스레드 목록 | 대화 | 컨텍스트. 실서버(/v1/admin/chat) 폴링.
const COPY = {
  en: { title: "Messages", sub: "Live chat from the site. Reply here — visitors see it instantly; offline ones get an email.", open: "Open", all: "All", guest: "Guest", empty: "Select a conversation.", none: "No conversations yet.", placeholder: "Type a reply…  (Enter to send)", close: "Close", reopen: "Reopen", customer: "Customer", orders: "Orders", activity: "Recent activity", since: "since", noEmail: "no email on file", assignMe: "Assign to me", assigned: "Assigned", unassign: "Unassign", addTag: "+ tag", tagPh: "tag name", quick: "Quick replies", sOpen: "Open", sToday: "24h", sUnread: "Unread", sResp: "Avg reply (min)", sCsat: "CSAT", pushOn: "Alerts on", pushOff: "Desktop alerts", pushDenied: "Notifications are blocked in your browser." },
  ko: { title: "메시지", sub: "사이트 라이브챗. 여기서 답장하면 방문자에게 즉시 표시되고, 오프라인이면 이메일로도 갑니다.", open: "진행중", all: "전체", guest: "방문자", empty: "대화를 선택하세요.", none: "아직 대화가 없어요.", placeholder: "답장 입력…  (Enter 전송)", close: "종료", reopen: "다시 열기", customer: "고객", orders: "주문", activity: "최근 활동", since: "가입", noEmail: "이메일 없음", assignMe: "나에게 배정", assigned: "담당", unassign: "배정 해제", addTag: "+ 태그", tagPh: "태그 이름", quick: "빠른 답변", sOpen: "진행중", sToday: "24시간", sUnread: "미확인", sResp: "평균 응답(분)", sCsat: "만족도", pushOn: "알림 켜짐", pushOff: "데스크톱 알림", pushDenied: "브라우저에서 알림이 차단되어 있어요." },
  zh: { title: "消息", sub: "网站在线聊天。在此回复，访客即时可见；离线访客会收到邮件。", open: "进行中", all: "全部", guest: "访客", empty: "选择一个对话。", none: "还没有对话。", placeholder: "输入回复…（Enter 发送）", close: "关闭", reopen: "重新打开", customer: "客户", orders: "订单", activity: "近期活动", since: "注册", noEmail: "无邮箱", assignMe: "分配给我", assigned: "负责", unassign: "取消分配", addTag: "+ 标签", tagPh: "标签名", quick: "快捷回复", sOpen: "进行中", sToday: "24小时", sUnread: "未读", sResp: "平均响应(分)", sCsat: "满意度", pushOn: "提醒已开", pushOff: "桌面提醒", pushDenied: "浏览器已屏蔽通知。" },
  es: { title: "Mensajes", sub: "Chat en vivo del sitio. Responde aquí — los visitantes lo ven al instante; los desconectados reciben un correo.", open: "Abierto", all: "Todos", guest: "Visitante", empty: "Selecciona una conversación.", none: "Aún no hay conversaciones.", placeholder: "Escribe una respuesta…  (Enter para enviar)", close: "Cerrar", reopen: "Reabrir", customer: "Cliente", orders: "Pedidos", activity: "Actividad reciente", since: "desde", noEmail: "sin correo", assignMe: "Asignarme", assigned: "Asignado", unassign: "Quitar", addTag: "+ etiqueta", tagPh: "nombre", quick: "Respuestas rápidas", sOpen: "Abiertos", sToday: "24h", sUnread: "Sin leer", sResp: "Resp. media (min)", sCsat: "CSAT", pushOn: "Alertas activas", pushOff: "Alertas de escritorio", pushDenied: "Las notificaciones están bloqueadas en tu navegador." },
};

// 스태프 빠른 답변 템플릿 (로케일별)
const QUICK_REPLIES = {
  en: ["Thanks for reaching out! How can I help?", "Happy to help — could you share a bit more (shape, carat, budget)?", "I'll send a video-call link shortly — what time works for you?", "Your order is on track; I'll update you as soon as there's news.", "Shipping is free, fully insured, with tracking. Anything else I can help with?"],
  ko: ["문의 주셔서 감사합니다! 무엇을 도와드릴까요?", "도와드릴게요 — 셰입·캐럿·예산을 조금만 더 알려주시겠어요?", "곧 화상 상담 링크 보내드릴게요 — 편하신 시간이 언제일까요?", "주문은 정상 진행 중이에요. 소식 생기는 대로 바로 알려드릴게요.", "배송은 무료·전액 보험·송장 제공이에요. 더 도와드릴 게 있을까요?"],
  zh: ["感谢您的咨询！有什么可以帮您？", "很乐意帮忙——能再多说一点吗（形状、克拉、预算）？", "我稍后发送视频通话链接——您什么时间方便？", "您的订单进展顺利，一有消息我会立即通知您。", "配送免费、全额保险并附物流。还有什么可以帮您？"],
  es: ["¡Gracias por escribir! ¿En qué puedo ayudarte?", "Con gusto — ¿puedes contarme un poco más (forma, quilates, presupuesto)?", "Te envío un enlace de videollamada enseguida — ¿qué hora te viene bien?", "Tu pedido va en camino; te aviso en cuanto haya novedades.", "El envío es gratis, asegurado y con seguimiento. ¿Algo más?"],
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
  const [stats, setStats] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [tagDraft, setTagDraft] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [pushState, setPushState] = useState("off"); // unsupported|denied|on|off

  const lastIdRef = useRef(0);
  const threadBodyRef = useRef(null);
  const fileRef = useRef(null);
  const achatRef = useRef(null);

  // 3-pane 인박스 높이를 실측으로 맞춰 뷰포트에 딱 들어오게 한다 — 사이트 헤더/콘솔헤드
  // 높이와 무관하게 답장 컴포저가 항상 화면 안에 보인다(컴포저 잘림·하단 빈 공간 버그 방지).
  useEffect(() => {
    const fit = () => {
      const el = achatRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(480, Math.round(window.innerHeight - top - 24))}px`;
    };
    fit();
    const id = window.setTimeout(fit, 300);
    window.addEventListener("resize", fit);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", fit); };
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const d = await apiFetch(`/admin/chat/threads?status=${status}${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}`);
      setThreads(d.threads || []);
    } catch (e) { setError(e.code || e.message); }
  }, [status, tagFilter]);

  const loadStats = useCallback(async () => {
    try { const d = await apiFetch("/admin/chat/stats"); setStats(d.stats || null); } catch { /* 무시 */ }
  }, []);

  // 목록·통계 폴링
  useEffect(() => {
    loadThreads(); loadStats();
    const id = window.setInterval(() => { loadThreads(); loadStats(); }, 8000);
    return () => window.clearInterval(id);
  }, [loadThreads, loadStats]);

  useEffect(() => { currentPushState().then(setPushState).catch(() => {}); }, []);

  async function togglePush() {
    try {
      setPushState(await (pushState === "on" ? disablePush() : enablePush()));
    } catch (e) {
      setPushState(await currentPushState());
      setError(e.message === "denied" ? c.pushDenied : (e.code || e.message));
    }
  }

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

  async function saveTags(tags) {
    try {
      const d = await apiFetch(`/admin/chat/threads/${activeCode}/tags`, { method: "POST", body: { tags } });
      setThread(d.thread); loadThreads(); loadStats();
    } catch (e) { setError(e.code || e.message); }
  }
  const removeTag = (tag) => saveTags((thread?.tags || []).filter((t) => t !== tag));
  function addTag() {
    const v = tagDraft.trim();
    if (!v) return;
    saveTags([...(thread?.tags || []), v]); setTagDraft("");
  }
  async function assignSelf(self) {
    try {
      const d = await apiFetch(`/admin/chat/threads/${activeCode}/assign`, { method: "POST", body: { self } });
      setThread(d.thread); loadThreads();
    } catch (e) { setError(e.code || e.message); }
  }
  const insertQuick = (text) => { setInput((v) => (v ? `${v} ` : "") + text); setShowQuick(false); };

  const nameOf = (t) => t.customerName || (t.visitorEmail ? t.visitorEmail : `${c.guest} · ${t.code.replace("CHAT-", "#")}`);

  return (
    <>
      <ConsoleHead kicker="Live chat" title={c.title} sub={c.sub} />
      {stats && <StatStrip stats={[
        { value: stats.open, label: c.sOpen },
        { value: stats.today, label: c.sToday },
        { value: stats.unread, label: c.sUnread },
        { value: stats.avgFirstResponseMin != null ? stats.avgFirstResponseMin : "—", label: c.sResp },
        { value: stats.avgCsat != null ? `${stats.avgCsat}★` : "—", label: c.sCsat },
      ]} />}
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="achat" ref={achatRef}>
        <div className="achat-list">
          <div className="achat-filter">
            {["open", "all"].map((s) => (
              <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
                {s === "open" ? c.open : c.all}
              </button>
            ))}
            {pushSupported() && pushState !== "unsupported" && (
              <button className={`achat-push${pushState === "on" ? " is-on" : ""}`}
                onClick={togglePush} disabled={pushState === "denied"}
                title={pushState === "denied" ? c.pushDenied : ""}>
                <Bell size={12} strokeWidth={1.9} /> {pushState === "on" ? c.pushOn : c.pushOff}
              </button>
            )}
          </div>
          {stats?.topTags?.length > 0 && (
            <div className="achat-filter achat-tagfilter">
              {stats.topTags.map((tt) => (
                <button key={tt.tag} className={tagFilter === tt.tag ? "active" : ""}
                  onClick={() => setTagFilter(tagFilter === tt.tag ? null : tt.tag)}>
                  {tt.tag} · {tt.count}
                </button>
              ))}
            </div>
          )}
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
                <div className="achat-conv-who">
                  <strong>{context?.customer?.name || thread?.visitorEmail || `${c.guest} · ${activeCode.replace("CHAT-", "#")}`}</strong>
                  <div className="achat-tags">
                    {(thread?.tags || []).map((tag) => (
                      <span className="achat-tag" key={tag}>{tag}<button onClick={() => removeTag(tag)} aria-label="remove">×</button></span>
                    ))}
                    <input className="achat-tag-input" placeholder={c.tagPh} value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  </div>
                </div>
                <div className="achat-conv-actions">
                  <button className={`button secondary small${thread?.assignedAdminId ? " is-on" : ""}`} onClick={() => assignSelf(!thread?.assignedAdminId)}>
                    <UserCheck size={13} strokeWidth={1.9} /> {thread?.assignedAdminId ? c.assigned : c.assignMe}
                  </button>
                  <button className="button secondary small" onClick={toggleStatus}>
                    {thread?.status === "open" ? c.close : c.reopen}
                  </button>
                </div>
              </div>
              <div className="achat-thread" ref={threadBodyRef}>
                {messages.map((m) => (
                  <div key={m.id} className={`achat-msg ${m.sender}`}>
                    {m.body && <span>{m.body}</span>}
                    {(m.attachments || []).map((a, i) => <ChatThumb key={i} a={a} />)}
                    {m.sender !== "system" && <span className="achat-msg-time">{hhmm(m.createdAt)}</span>}
                  </div>
                ))}
              </div>
              {showQuick && (
                <div className="achat-quick">
                  {(QUICK_REPLIES[locale] || QUICK_REPLIES.en).map((q, i) => (
                    <button key={i} type="button" onClick={() => insertQuick(q)}>{q}</button>
                  ))}
                </div>
              )}
              <div className="achat-composer">
                <button className="chat-attach" aria-label={c.quick} onClick={() => setShowQuick((v) => !v)}>
                  <MessageSquareText size={18} strokeWidth={1.8} />
                </button>
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
