import { useEffect, useMemo, useState } from "react";
import {
  Building2, Check, Copy, ExternalLink, Mail, Plus, RefreshCw, Search, Send, ShieldCheck, X,
} from "lucide-react";
import { apiFetch } from "../../lib/api.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead, StatStrip } from "./console.jsx";

const COPY = {
  en: {
    kicker: "VENDOR ACCESS", title: "Vendor onboarding", subtitle: "Create one secure login per workshop, deliver its invitation, then assign work after activation.",
    newVendor: "Invite vendor", close: "Close", createTitle: "Create a vendor account", createHint: "The Vendor receives a seven-day activation link and creates their own password.",
    name: "Workshop display name", contact: "Primary contact", email: "Login email", locale: "Workspace language", create: "Create & send invitation", creating: "Creating…",
    stepAccount: "Create account", stepInvite: "Send secure invite", stepActivate: "Vendor activates", automatic: "Automatic after submit", vendorAction: "Completed by Vendor",
    invitationReady: "Invitation ready", emailDelivered: "Invitation email sent", emailFallback: "Email delivery was unavailable. Copy and send the secure link manually.",
    expires: "Expires", copy: "Copy link", copied: "Invitation link copied", open: "Open link", dismiss: "Dismiss",
    total: "Total vendors", pending: "Awaiting activation", active: "Active", suspended: "Suspended", activeOrders: "Active orders",
    directory: "Vendor directory", search: "Search workshop, contact, email or ID", all: "All", noVendors: "No vendors match this view.",
    vendor: "Vendor", access: "Access", activity: "Activity", actions: "Actions", lastLogin: "Last login", never: "Never", invitedOn: "Invited", inviteExpired: "Invite expired",
    inviteAgain: "Send new invite", suspend: "Suspend", activate: "Restore", statusInvited: "Invited", statusActive: "Active", statusSuspended: "Suspended", statusArchived: "Archived",
    assignment: "Assign an order", assignmentHint: "Only activated Vendors can receive work. Assignment immediately appears in their workspace.", orderCode: "Order code", due: "Vendor due date", assign: "Assign order", assigned: "Order assigned",
    created: "Vendor created and invitation prepared", resent: "A new invitation was prepared", restored: "Vendor access restored", paused: "Vendor access suspended", failed: "Request failed", loadFailed: "Vendors could not be loaded.",
    confirmSuspend: (name) => `Suspend access for ${name}? Their current workspace sessions will stop working.`,
  },
  zh: {
    kicker: "供应商权限", title: "Vendor 邀请与入驻", subtitle: "每个工坊创建一个安全账号，发送邀请；Vendor 激活后再分配订单。",
    newVendor: "邀请 Vendor", close: "关闭", createTitle: "创建 Vendor 账号", createHint: "Vendor 会收到一个 7 天有效的激活链接，并自行设置登录密码。",
    name: "工坊显示名称", contact: "主要联系人", email: "登录邮箱", locale: "工作台语言", create: "创建并发送邀请", creating: "正在创建…",
    stepAccount: "创建账号", stepInvite: "发送安全邀请", stepActivate: "Vendor 激活", automatic: "提交后自动完成", vendorAction: "由 Vendor 完成",
    invitationReady: "邀请已准备好", emailDelivered: "邀请邮件已发送", emailFallback: "邮件发送暂不可用，请复制安全链接并手动发送。",
    expires: "失效时间", copy: "复制链接", copied: "邀请链接已复制", open: "打开链接", dismiss: "收起",
    total: "Vendor 总数", pending: "待激活", active: "已激活", suspended: "已暂停", activeOrders: "进行中订单",
    directory: "Vendor 目录", search: "搜索工坊、联系人、邮箱或 ID", all: "全部", noVendors: "当前筛选下没有 Vendor。",
    vendor: "Vendor", access: "账号状态", activity: "使用情况", actions: "操作", lastLogin: "最近登录", never: "从未登录", invitedOn: "邀请于", inviteExpired: "邀请已过期",
    inviteAgain: "发送新邀请", suspend: "暂停权限", activate: "恢复权限", statusInvited: "待激活", statusActive: "已激活", statusSuspended: "已暂停", statusArchived: "已归档",
    assignment: "分配订单", assignmentHint: "只有已激活 Vendor 可以接单；分配后订单会立即出现在其工作台。", orderCode: "订单号", due: "Vendor 交期", assign: "确认分配", assigned: "订单已分配",
    created: "Vendor 已创建，邀请已准备好", resent: "新的邀请已准备好", restored: "Vendor 权限已恢复", paused: "Vendor 权限已暂停", failed: "操作失败", loadFailed: "无法加载 Vendor 列表。",
    confirmSuspend: (name) => `确认暂停 ${name} 的访问权限？其当前工作台登录会立即失效。`,
  },
  ko: {
    kicker: "벤더 접근", title: "벤더 초대 및 온보딩", subtitle: "공방마다 안전한 계정 하나를 만들고 초대한 뒤, 활성화가 끝나면 주문을 배정합니다.",
    newVendor: "벤더 초대", close: "닫기", createTitle: "벤더 계정 만들기", createHint: "벤더는 7일 동안 유효한 활성화 링크를 받고 직접 비밀번호를 설정합니다.",
    name: "공방 표시 이름", contact: "주 담당자", email: "로그인 이메일", locale: "작업공간 언어", create: "계정 생성 및 초대", creating: "생성 중…",
    stepAccount: "계정 생성", stepInvite: "보안 초대 전송", stepActivate: "벤더 활성화", automatic: "제출 후 자동", vendorAction: "벤더가 완료",
    invitationReady: "초대 준비 완료", emailDelivered: "초대 이메일을 보냈습니다", emailFallback: "이메일을 보내지 못했습니다. 보안 링크를 복사해 직접 전달하세요.",
    expires: "만료", copy: "링크 복사", copied: "초대 링크를 복사했습니다", open: "링크 열기", dismiss: "닫기",
    total: "전체 벤더", pending: "활성화 대기", active: "활성", suspended: "중지", activeOrders: "진행 주문",
    directory: "벤더 디렉터리", search: "공방, 담당자, 이메일 또는 ID 검색", all: "전체", noVendors: "현재 보기에 해당하는 벤더가 없습니다.",
    vendor: "벤더", access: "접근 상태", activity: "활동", actions: "작업", lastLogin: "최근 로그인", never: "로그인 없음", invitedOn: "초대", inviteExpired: "초대 만료",
    inviteAgain: "새 초대 보내기", suspend: "접근 중지", activate: "복구", statusInvited: "초대됨", statusActive: "활성", statusSuspended: "중지", statusArchived: "보관됨",
    assignment: "주문 배정", assignmentHint: "활성화된 벤더만 주문을 받을 수 있으며 배정 즉시 작업공간에 표시됩니다.", orderCode: "주문번호", due: "벤더 납기", assign: "주문 배정", assigned: "주문을 배정했습니다",
    created: "벤더와 초대를 준비했습니다", resent: "새 초대를 준비했습니다", restored: "벤더 접근을 복구했습니다", paused: "벤더 접근을 중지했습니다", failed: "요청 실패", loadFailed: "벤더 목록을 불러오지 못했습니다.",
    confirmSuspend: (name) => `${name}의 접근을 중지할까요? 현재 작업공간 세션도 사용할 수 없게 됩니다.`,
  },
};

const EMPTY_VENDOR = { displayName: "", contactName: "", email: "", locale: "zh" };
const EMPTY_ASSIGNMENT = { orderCode: "", supplierCode: "", dueAt: "" };
const FILTERS = ["all", "invited", "active", "suspended"];

function formatWhen(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminSuppliers() {
  const { locale } = useLocale();
  const t = COPY[locale] || COPY.en;
  const [suppliers, setSuppliers] = useState([]);
  const [vendor, setVendor] = useState(EMPTY_VENDOR);
  const [assignment, setAssignment] = useState(EMPTY_ASSIGNMENT);
  const [invitation, setInvitation] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const result = await apiFetch("/admin/suppliers");
    setSuppliers(result.suppliers || []);
  };

  useEffect(() => {
    load().catch(() => setError(t.loadFailed)).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    total: suppliers.length,
    invited: suppliers.filter((item) => item.status === "invited").length,
    active: suppliers.filter((item) => item.status === "active").length,
    suspended: suppliers.filter((item) => item.status === "suspended").length,
    orders: suppliers.reduce((sum, item) => sum + Number(item.activeOrderCount || 0), 0),
  }), [suppliers]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return suppliers.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!needle) return true;
      return [item.displayName, item.contactName, item.email, item.supplierCode]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [filter, query, suppliers]);

  const showInvitation = (result, supplier) => {
    setInvitation({
      url: result.inviteUrl,
      emailSent: result.emailSent,
      expiresAt: result.expiresAt,
      email: supplier.email,
      displayName: supplier.displayName,
    });
  };

  const create = async (event) => {
    event.preventDefault(); setBusy("create"); setError(""); setNotice("");
    try {
      const created = await apiFetch("/admin/suppliers", { method: "POST", body: vendor });
      const result = await apiFetch(`/admin/suppliers/${created.supplier.supplierCode}/invites`, { method: "POST" });
      showInvitation(result, created.supplier);
      setVendor(EMPTY_VENDOR); setShowCreate(false); setNotice(t.created); await load();
    } catch (e) { setError(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(""); }
  };

  const invite = async (supplier) => {
    setBusy(`invite-${supplier.supplierCode}`); setError(""); setNotice("");
    try {
      const result = await apiFetch(`/admin/suppliers/${supplier.supplierCode}/invites`, { method: "POST" });
      showInvitation(result, supplier); setNotice(t.resent); await load();
    } catch (e) { setError(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(""); }
  };

  const changeStatus = async (supplier, next) => {
    if (next === "suspended" && !window.confirm(t.confirmSuspend(supplier.displayName))) return;
    setBusy(`status-${supplier.supplierCode}`); setError(""); setNotice("");
    try {
      await apiFetch(`/admin/suppliers/${supplier.supplierCode}`, { method: "PATCH", body: { status: next } });
      setNotice(next === "active" ? t.restored : t.paused); await load();
    } catch (e) { setError(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(""); }
  };

  const assign = async (event) => {
    event.preventDefault(); setBusy("assign"); setError(""); setNotice("");
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(assignment.orderCode.trim())}/supplier`, {
        method: "POST", body: { supplierCode: assignment.supplierCode, dueAt: assignment.dueAt || null },
      });
      setNotice(t.assigned); setAssignment(EMPTY_ASSIGNMENT); await load();
    } catch (e) { setError(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(""); }
  };

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitation.url);
      setNotice(t.copied);
    } catch { setError(`${t.failed}: CLIPBOARD_UNAVAILABLE`); }
  };

  return <>
    <ConsoleHead kicker={t.kicker} title={t.title} sub={t.subtitle}>
      <button className="button primary small" type="button" onClick={() => setShowCreate((value) => !value)}>
        {showCreate ? <X size={14} /> : <Plus size={14} />} {showCreate ? t.close : t.newVendor}
      </button>
    </ConsoleHead>

    <StatStrip stats={[
      { value: stats.total, label: t.total }, { value: stats.invited, label: t.pending },
      { value: stats.active, label: t.active }, { value: stats.orders, label: t.activeOrders },
    ]} />

    {error && <p className="admin-save-notice is-error" role="alert">{error}</p>}
    {notice && <p className="admin-save-notice" role="status">{notice}</p>}

    {invitation && <section className={`vendor-invite-result ${invitation.emailSent ? "is-sent" : "is-fallback"}`}>
      <div className="vendor-result-icon">{invitation.emailSent ? <Mail size={19} /> : <Copy size={19} />}</div>
      <div className="vendor-result-copy">
        <p className="con-kicker">{t.invitationReady}</p>
        <h3>{invitation.displayName}</h3>
        <p>{invitation.emailSent ? `${t.emailDelivered} · ${invitation.email}` : t.emailFallback}</p>
        <small>{t.expires}: {formatWhen(invitation.expiresAt)}</small>
      </div>
      <div className="vendor-result-actions">
        <button className="button secondary small" type="button" onClick={copyInvitation}><Copy size={13} /> {t.copy}</button>
        <a className="button secondary small" href={invitation.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {t.open}</a>
        <button className="vendor-dismiss" type="button" aria-label={t.dismiss} onClick={() => setInvitation(null)}><X size={15} /></button>
      </div>
    </section>}

    {showCreate && <section className="vendor-onboard-panel">
      <div className="vendor-onboard-intro">
        <Building2 size={22} />
        <div><h3>{t.createTitle}</h3><p>{t.createHint}</p></div>
      </div>
      <div className="vendor-flow-steps" aria-label={t.createTitle}>
        <div><span>01</span><strong>{t.stepAccount}</strong><small>{t.automatic}</small></div>
        <div><span>02</span><strong>{t.stepInvite}</strong><small>{t.automatic}</small></div>
        <div><span>03</span><strong>{t.stepActivate}</strong><small>{t.vendorAction}</small></div>
      </div>
      <form className="vendor-create-form" onSubmit={create}>
        <div className="con-grid con-grid-2">
          <label className="field"><span>{t.name}</span><input required autoFocus value={vendor.displayName} onChange={(e) => setVendor({ ...vendor, displayName: e.target.value })} /></label>
          <label className="field"><span>{t.contact}</span><input required value={vendor.contactName} onChange={(e) => setVendor({ ...vendor, contactName: e.target.value })} /></label>
          <label className="field"><span>{t.email}</span><input required type="email" autoComplete="off" value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} /></label>
          <label className="field"><span>{t.locale}</span><select value={vendor.locale} onChange={(e) => setVendor({ ...vendor, locale: e.target.value })}><option value="zh">中文</option><option value="en">English</option><option value="ko">한국어</option></select></label>
        </div>
        <div className="vendor-form-actions"><ShieldCheck size={15} /><span>{t.createHint}</span><button className="button primary small" disabled={busy === "create"}><Send size={14} /> {busy === "create" ? t.creating : t.create}</button></div>
      </form>
    </section>}

    <div className="con-section-label"><h3>{t.directory}</h3><span className="con-count">{filtered.length} / {suppliers.length}</span></div>
    <div className="vendor-directory-tools">
      <label className="con-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} /></label>
      <div className="con-filters">{FILTERS.map((key) => <button key={key} className={filter === key ? "is-active" : ""} type="button" onClick={() => setFilter(key)}>{key === "all" ? t.all : t[`status${key[0].toUpperCase()}${key.slice(1)}`]}</button>)}</div>
    </div>

    <div className="con-table-panel vendor-table-panel">
      {loading ? <p className="con-note">…</p> : filtered.length === 0 ? <div className="vendor-empty"><Building2 size={22} /><p>{t.noVendors}</p></div> : <table className="data-table">
        <thead><tr><th>{t.vendor}</th><th>{t.access}</th><th>{t.activity}</th><th>{t.actions}</th></tr></thead>
        <tbody>{filtered.map((supplier) => {
          const inviteExpired = supplier.status === "invited" && supplier.inviteExpiresAt && new Date(supplier.inviteExpiresAt) <= new Date();
          const actionBusy = busy.endsWith(supplier.supplierCode);
          return <tr key={supplier.supplierCode}>
            <td><div className="vendor-identity"><span>{supplier.displayName?.slice(0, 1)?.toUpperCase() || "V"}</span><div><strong>{supplier.displayName}</strong><small>{supplier.contactName} · {supplier.email}</small><code>{supplier.supplierCode}</code></div></div></td>
            <td><span className={`vendor-status is-${inviteExpired ? "expired" : supplier.status}`}>{inviteExpired ? t.inviteExpired : t[`status${supplier.status[0].toUpperCase()}${supplier.status.slice(1)}`] || supplier.status}</span>{supplier.status === "invited" && <small className="vendor-invite-date">{t.invitedOn} {formatWhen(supplier.invitedAt)}</small>}</td>
            <td><strong className="vendor-order-count">{supplier.activeOrderCount || 0} {t.activeOrders}</strong><small>{t.lastLogin}: {formatWhen(supplier.lastLoginAt, t.never)}</small></td>
            <td><div className="vendor-table-actions">{["invited", "active"].includes(supplier.status) && <button className="button secondary small" type="button" disabled={actionBusy} onClick={() => invite(supplier)}><RefreshCw size={12} /> {t.inviteAgain}</button>}{["active", "suspended"].includes(supplier.status) && <button className="button secondary small" type="button" disabled={actionBusy} onClick={() => changeStatus(supplier, supplier.status === "active" ? "suspended" : "active")}>{supplier.status === "active" ? t.suspend : t.activate}</button>}</div></td>
          </tr>;
        })}</tbody>
      </table>}
    </div>

    <div className="con-section-label"><h3>{t.assignment}</h3></div>
    <form className="vendor-assignment con-table-panel" onSubmit={assign}>
      <p>{t.assignmentHint}</p>
      <div className="con-grid con-grid-2">
        <label className="field"><span>{t.orderCode}</span><input required placeholder="BD-..." value={assignment.orderCode} onChange={(e) => setAssignment({ ...assignment, orderCode: e.target.value })} /></label>
        <label className="field"><span>{t.vendor}</span><select required value={assignment.supplierCode} onChange={(e) => setAssignment({ ...assignment, supplierCode: e.target.value })}><option value="">—</option>{suppliers.filter((item) => item.status === "active").map((item) => <option key={item.supplierCode} value={item.supplierCode}>{item.displayName} · {item.supplierCode}</option>)}</select></label>
        <label className="field"><span>{t.due}</span><input type="date" value={assignment.dueAt} onChange={(e) => setAssignment({ ...assignment, dueAt: e.target.value })} /></label>
      </div>
      <button className="button primary small" disabled={busy === "assign" || !assignment.supplierCode}><Check size={14} /> {t.assign}</button>
    </form>
  </>;
}
