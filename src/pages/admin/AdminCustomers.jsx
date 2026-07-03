// 회원 CRM — 프로필(언어·기본 배송지)과 주문 이력(건수·총구매·진행 금액)을 한 화면에.
// 활동/전환 지표는 /admin/analytics(구 Members & Activity)로 분리됐다.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const COPY = {
  en: {
    kicker: "MEMBERS", empty: "No members yet — customers appear after their first sign-in or order.",
    needAuth: "This console needs a server admin session. Sign in again through the admin gate.",
    unavailable: "API unreachable — run the local API server or check the deployment.",
    member: "Member", locale: "Language", address: "Shipping address", orders: "Orders",
    totalSpent: "Total spent", openValue: "In progress", joined: "Joined",
    noAddress: "—", noOrders: "No orders yet", total: "Total",
    statMembers: "Members", statBuyers: "With orders", statRevenue: "Total revenue", statOpen: "Open value",
  },
  ko: {
    kicker: "회원", empty: "아직 회원이 없습니다 — 첫 로그인 또는 주문 후 나타납니다.",
    needAuth: "이 콘솔은 서버 어드민 세션이 필요합니다. 어드민 게이트에서 다시 로그인해 주세요.",
    unavailable: "API에 연결할 수 없습니다 — 로컬 API 서버를 켜거나 배포 상태를 확인하세요.",
    member: "회원", locale: "언어", address: "배송지", orders: "주문",
    totalSpent: "총 구매액", openValue: "진행 중 금액", joined: "가입",
    noAddress: "—", noOrders: "주문 없음", total: "총액",
    statMembers: "회원 수", statBuyers: "주문 회원", statRevenue: "총 매출", statOpen: "진행 중 금액",
  },
  zh: {
    kicker: "会员", empty: "暂无会员 — 客户在首次登录或下单后出现。",
    needAuth: "此控制台需要服务器管理员会话，请通过管理入口重新登录。",
    unavailable: "无法连接 API — 请启动本地 API 服务器或检查部署。",
    member: "会员", locale: "语言", address: "收货地址", orders: "订单",
    totalSpent: "总消费", openValue: "进行中金额", joined: "注册",
    noAddress: "—", noOrders: "暂无订单", total: "总价",
    statMembers: "会员数", statBuyers: "有订单会员", statRevenue: "总收入", statOpen: "进行中金额",
  },
  es: {
    kicker: "MIEMBROS", empty: "Aún no hay miembros — aparecen tras su primer acceso o pedido.",
    needAuth: "Esta consola requiere sesión de administrador del servidor. Inicia sesión de nuevo por la puerta admin.",
    unavailable: "API inalcanzable — inicia el servidor local o revisa el despliegue.",
    member: "Miembro", locale: "Idioma", address: "Dirección de envío", orders: "Pedidos",
    totalSpent: "Total comprado", openValue: "En curso", joined: "Alta",
    noAddress: "—", noOrders: "Sin pedidos", total: "Total",
    statMembers: "Miembros", statBuyers: "Con pedidos", statRevenue: "Ingresos totales", statOpen: "Valor en curso",
  },
};

const LOCALE_LABELS = { en: "EN", ko: "한국어", zh: "中文", es: "ES" };

function addressLine(a) {
  if (!a || !a.addressLine1) return null;
  return [a.city, a.region, a.country].filter(Boolean).join(", ");
}

export default function AdminCustomers() {
  const { locale } = useLocale();
  const t = COPY[locale] || COPY.en;
  const [state, setState] = useState({ status: "loading", data: null });
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    apiFetch("/admin/customers")
      .then((d) => setState({ status: "ok", data: d.customers }))
      .catch((e) => setState({ status: e instanceof ApiUnavailableError ? "unavailable" : "auth", data: null }));
  }, []);

  if (state.status === "loading") return <div className="panel"><p className="form-hint">…</p></div>;
  if (state.status !== "ok") {
    return <div className="panel"><p className="form-hint">{state.status === "auth" ? t.needAuth : t.unavailable}</p></div>;
  }

  const members = state.data;
  const buyers = members.filter((m) => m.orderCount > 0);
  const revenue = members.reduce((s, m) => s + m.totalSpent, 0);
  const openValue = members.reduce((s, m) => s + m.openValue, 0);

  return (
    <div className="form-stack">
      <p className="admin-kicker">{t.kicker}</p>
      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="summary-card"><div className="num">{members.length}</div><div className="lbl">{t.statMembers}</div></div>
        <div className="summary-card"><div className="num">{buyers.length}</div><div className="lbl">{t.statBuyers}</div></div>
        <div className="summary-card"><div className="num">{usd(revenue)}</div><div className="lbl">{t.statRevenue}</div></div>
        <div className="summary-card"><div className="num">{usd(openValue)}</div><div className="lbl">{t.statOpen}</div></div>
      </div>

      {members.length === 0 ? (
        <div className="panel"><p className="form-hint">{t.empty}</p></div>
      ) : (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.member}</th><th>{t.locale}</th><th>{t.address}</th>
                <th>{t.orders}</th><th>{t.totalSpent}</th><th>{t.openValue}</th><th>{t.joined}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRows key={m.id} m={m} t={t} open={openId === m.id}
                  onToggle={() => setOpenId(openId === m.id ? null : m.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MemberRows({ m, t, open, onToggle }) {
  const addr = addressLine(m.defaultAddress);
  return (
    <>
      <tr className="row-clickable" onClick={onToggle}>
        <td><strong>{m.name || m.email}</strong><br /><span className="form-hint">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></td>
        <td>{LOCALE_LABELS[m.locale] || m.locale}</td>
        <td>{addr || t.noAddress}</td>
        <td>{m.orderCount}</td>
        <td>{m.totalSpent > 0 ? usd(m.totalSpent) : "—"}</td>
        <td>{m.openValue > 0 ? usd(m.openValue) : "—"}</td>
        <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: "var(--bg-2)" }}>
            {m.defaultAddress?.addressLine1 && (
              <p className="form-hint" style={{ margin: "6px 0 10px" }}>
                {m.defaultAddress.recipientName} · {m.defaultAddress.phone} · {[
                  m.defaultAddress.addressLine1, m.defaultAddress.addressLine2, m.defaultAddress.city,
                  m.defaultAddress.region, m.defaultAddress.postalCode, m.defaultAddress.country,
                ].filter(Boolean).join(", ")}
              </p>
            )}
            {m.orders.length === 0 ? (
              <p className="form-hint" style={{ margin: "6px 0" }}>{t.noOrders}</p>
            ) : (
              <div className="form-stack" style={{ gap: 0 }}>
                {m.orders.map((o) => (
                  <div key={o.orderCode} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hair)" }}>
                    <span>
                      <Link className="text-link" to={`/admin/live/${o.orderCode}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{o.orderCode}</strong>
                      </Link>
                      {" "}<span className={`status-badge ${o.stage === "DELIVERED" ? "mst-done" : o.stage === "CANCELLED" ? "mst-pending" : "mst-inProgress"}`}>{o.stage}</span>
                    </span>
                    <span className="form-hint" style={{ whiteSpace: "nowrap" }}>
                      {o.totalUsd ? `${t.total} ${usd(Number(o.totalUsd))} · ` : ""}{new Date(o.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
