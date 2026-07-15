import { useEffect, useState } from "react";
import { Check, Copy, Link2, Plus, RefreshCw } from "lucide-react";
import { apiFetch } from "../../lib/api.js";
import { useLocale } from "../../i18n.jsx";

const COPY = {
  en: {
    kicker: "VENDOR ACCESS", title: "Vendors", subtitle: "One vendor is one login account.",
    create: "Create vendor & invitation", name: "Vendor display name", contact: "Contact name", email: "Login email", locale: "Language",
    invitation: "Invitation link", copy: "Copy", copied: "Copied", noVendors: "No vendors yet.", activeOrders: "Active orders", lastLogin: "Last login",
    suspend: "Suspend", activate: "Activate", inviteAgain: "New invite", assignment: "Assign an order", orderCode: "Order code", vendor: "Vendor", due: "Vendor due date", assign: "Assign",
    assigned: "Order assigned", failed: "Request failed", status: "Status",
  },
  zh: {
    kicker: "供应商权限", title: "供应商管理", subtitle: "一个 Vendor 对应一个登录账号。",
    create: "创建 Vendor 并生成邀请", name: "Vendor 显示名称", contact: "联系人", email: "登录邮箱", locale: "界面语言",
    invitation: "邀请链接", copy: "复制", copied: "已复制", noVendors: "暂无 Vendor。", activeOrders: "进行中订单", lastLogin: "最近登录",
    suspend: "暂停", activate: "恢复", inviteAgain: "重新邀请", assignment: "分配订单", orderCode: "订单号", vendor: "Vendor", due: "Vendor 交期", assign: "确认分配",
    assigned: "订单已分配", failed: "操作失败", status: "状态",
  },
  ko: {
    kicker: "벤더 접근", title: "벤더 관리", subtitle: "벤더 하나당 로그인 계정 하나를 사용합니다.",
    create: "벤더 생성 및 초대", name: "벤더 표시 이름", contact: "담당자", email: "로그인 이메일", locale: "화면 언어",
    invitation: "초대 링크", copy: "복사", copied: "복사됨", noVendors: "등록된 벤더가 없습니다.", activeOrders: "진행 주문", lastLogin: "최근 로그인",
    suspend: "중지", activate: "활성화", inviteAgain: "새 초대", assignment: "주문 배정", orderCode: "주문번호", vendor: "벤더", due: "벤더 납기", assign: "배정",
    assigned: "주문을 배정했습니다", failed: "요청 실패", status: "상태",
  },
};

const EMPTY_VENDOR = { displayName: "", contactName: "", email: "", locale: "zh" };
const EMPTY_ASSIGNMENT = { orderCode: "", supplierCode: "", dueAt: "" };

export default function AdminSuppliers() {
  const { locale } = useLocale();
  const t = COPY[locale] || COPY.en;
  const [suppliers, setSuppliers] = useState([]);
  const [vendor, setVendor] = useState(EMPTY_VENDOR);
  const [assignment, setAssignment] = useState(EMPTY_ASSIGNMENT);
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await apiFetch("/admin/suppliers");
    setSuppliers(result.suppliers || []);
  };
  useEffect(() => { load().catch(() => setMessage(t.failed)); }, []);

  const create = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const created = await apiFetch("/admin/suppliers", { method: "POST", body: vendor });
      const invite = await apiFetch(`/admin/suppliers/${created.supplier.supplierCode}/invites`, { method: "POST" });
      setInviteUrl(invite.inviteUrl); setVendor(EMPTY_VENDOR); await load();
    } catch (e) { setMessage(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(false); }
  };

  const invite = async (supplierCode) => {
    setBusy(true); setMessage("");
    try {
      const result = await apiFetch(`/admin/suppliers/${supplierCode}/invites`, { method: "POST" });
      setInviteUrl(result.inviteUrl);
    } catch (e) { setMessage(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(false); }
  };

  const status = async (supplier, next) => {
    setBusy(true); setMessage("");
    try {
      await apiFetch(`/admin/suppliers/${supplier.supplierCode}`, { method: "PATCH", body: { status: next } });
      await load();
    } catch (e) { setMessage(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(false); }
  };

  const assign = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await apiFetch(`/admin/orders/${encodeURIComponent(assignment.orderCode)}/supplier`, {
        method: "POST",
        body: { supplierCode: assignment.supplierCode, dueAt: assignment.dueAt || null },
      });
      setMessage(t.assigned); setAssignment(EMPTY_ASSIGNMENT); await load();
    } catch (e) { setMessage(`${t.failed}: ${e.code || "UNKNOWN"}`); } finally { setBusy(false); }
  };

  return <div className="form-stack">
    <div><p className="admin-kicker">{t.kicker}</p><h2 style={{ margin: "2px 0 5px" }}>{t.title}</h2><p className="form-hint">{t.subtitle}</p></div>

    <form className="panel" onSubmit={create}>
      <div className="con-grid-2">
        <label className="field"><span>{t.name}</span><input required value={vendor.displayName} onChange={(e) => setVendor({ ...vendor, displayName: e.target.value })} /></label>
        <label className="field"><span>{t.contact}</span><input required value={vendor.contactName} onChange={(e) => setVendor({ ...vendor, contactName: e.target.value })} /></label>
        <label className="field"><span>{t.email}</span><input required type="email" value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} /></label>
        <label className="field"><span>{t.locale}</span><select value={vendor.locale} onChange={(e) => setVendor({ ...vendor, locale: e.target.value })}><option value="zh">中文</option><option value="en">English</option><option value="ko">한국어</option></select></label>
      </div>
      <button className="button primary small" disabled={busy} style={{ marginTop: 14 }}><Plus size={14} /> {t.create}</button>
    </form>

    {inviteUrl && <div className="panel" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><Link2 size={17} /><strong>{t.invitation}</strong><input readOnly value={inviteUrl} style={{ flex: "1 1 320px" }} /><button className="button secondary small" type="button" onClick={async () => { await navigator.clipboard.writeText(inviteUrl); setMessage(t.copied); }}><Copy size={13} /> {t.copy}</button></div>}

    <form className="panel" onSubmit={assign}>
      <p className="admin-kicker">{t.assignment}</p>
      <div className="con-grid-2">
        <label className="field"><span>{t.orderCode}</span><input required placeholder="BD-..." value={assignment.orderCode} onChange={(e) => setAssignment({ ...assignment, orderCode: e.target.value })} /></label>
        <label className="field"><span>{t.vendor}</span><select required value={assignment.supplierCode} onChange={(e) => setAssignment({ ...assignment, supplierCode: e.target.value })}><option value="">—</option>{suppliers.filter((x) => x.status === "active").map((x) => <option key={x.supplierCode} value={x.supplierCode}>{x.displayName} · {x.supplierCode}</option>)}</select></label>
        <label className="field"><span>{t.due}</span><input type="date" value={assignment.dueAt} onChange={(e) => setAssignment({ ...assignment, dueAt: e.target.value })} /></label>
      </div>
      <button className="button primary small" disabled={busy || !assignment.supplierCode} style={{ marginTop: 14 }}><Check size={14} /> {t.assign}</button>
    </form>

    {message && <p className="form-hint">{message}</p>}
    <div className="panel" style={{ overflowX: "auto" }}>
      {suppliers.length === 0 ? <p className="form-hint">{t.noVendors}</p> : <table className="data-table"><thead><tr><th>Vendor</th><th>{t.status}</th><th>{t.activeOrders}</th><th>{t.lastLogin}</th><th /></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.supplierCode}><td><strong>{supplier.displayName}</strong><br /><span className="form-hint">{supplier.supplierCode} · {supplier.email}</span></td><td>{supplier.status}</td><td>{supplier.activeOrderCount}</td><td>{supplier.lastLoginAt ? new Date(supplier.lastLoginAt).toLocaleString() : "—"}</td><td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="button secondary small" disabled={busy} onClick={() => invite(supplier.supplierCode)}><RefreshCw size={12} /> {t.inviteAgain}</button>{["active", "suspended"].includes(supplier.status) && <button className="button secondary small" disabled={busy} onClick={() => status(supplier, supplier.status === "active" ? "suspended" : "active")}>{supplier.status === "active" ? t.suspend : t.activate}</button>}</td></tr>)}</tbody></table>}
    </div>
  </div>;
}
