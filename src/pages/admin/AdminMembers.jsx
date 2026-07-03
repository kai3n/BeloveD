// 회원·활동 대시보드 — KPI/인기 스타일/전환 퍼널 + 회원 목록 + 개인 타임라인.
// 데이터는 전부 실서버 API(/v1/admin/*) — 데모 빌드/서버 부재 시 안내만 보여준다.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { pickI18n, useLocale } from "../../i18n.jsx";
import { getOpsStyle } from "../../lib/store.js";
import { getDesignSlotStyle } from "../../lib/designSlots.js";

function useStyleName() {
  const { locale } = useLocale();
  return (styleId) => {
    if (!styleId) return "";
    const style = getOpsStyle(styleId) || getDesignSlotStyle(styleId);
    return style ? pickI18n(style.name, locale) || styleId : styleId;
  };
}

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminMembers() {
  const { p } = useLocale();
  const s = p.opsA.members;
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  const styleName = useStyleName();

  useEffect(() => {
    Promise.all([apiFetch("/admin/activity/overview"), apiFetch("/admin/members")])
      .then(([o, m]) => { setOverview(o); setMembers(m.members); })
      .catch((e) => setError(e instanceof ApiUnavailableError ? "demo" : "error"));
  }, []);

  if (error === "demo") return <p className="empty-note">{s.demoUnavailable}</p>;
  if (error) return <p className="empty-note">—</p>;
  if (!overview || !members) return <p className="page-sub">…</p>;

  const { kpi, topStyles, funnel, trend } = overview;
  const maxTrend = Math.max(...trend.map((t) => t.pageViews), 1);

  return (
    <div>
      <h2 className="panel-title">{s.title}</h2>

      <div className="summary-grid">
        <div className="summary-card"><div className="num">{kpi.sessionsToday}</div><div className="lbl">{s.kpi.today}</div></div>
        <div className="summary-card"><div className="num">{kpi.sessions7d}</div><div className="lbl">{s.kpi.sessions7d}</div></div>
        <div className="summary-card"><div className="num">{kpi.pageViews7d}</div><div className="lbl">{s.kpi.pageViews7d}</div></div>
        <div className="summary-card"><div className="num">{kpi.activeMembers7d}</div><div className="lbl">{s.kpi.active}</div></div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>{s.funnel.title}</h3>
        <div className="summary-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="summary-card"><div className="num">{funnel.styleViews}</div><div className="lbl">{s.funnel.views}</div></div>
          <div className="summary-card"><div className="num">{funnel.intakeStarts}</div><div className="lbl">{s.funnel.starts}</div></div>
          <div className="summary-card"><div className="num">{funnel.intakeSubmits}</div><div className="lbl">{s.funnel.submits}</div></div>
        </div>
      </div>

      {topStyles.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h3>{s.topStyles}</h3>
          <table className="data-table">
            <tbody>
              {topStyles.map((row) => (
                <tr key={row.entityId}>
                  <td><Link to={`/designs/${row.entityId}`}>{styleName(row.entityId)}</Link></td>
                  <td>{row.views} {s.views}</td>
                  <td>{row.clicks} {s.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trend.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h3>{s.trend}</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }} aria-hidden="true">
            {trend.map((t) => (
              <div key={t.day} title={`${t.day.slice(0, 10)} · ${t.pageViews}`}
                style={{ flex: 1, minWidth: 6, background: "var(--accent)", opacity: 0.75,
                         height: `${Math.max((t.pageViews / maxTrend) * 100, 4)}%` }} />
            ))}
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>{p.opsA.menu.members}</h3>
        {members.length === 0 ? <p className="empty-note">{s.emptyMembers}</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{s.table.name}</th><th>{s.table.email}</th><th>{s.table.joined}</th>
                <th>{s.table.lastActive}</th><th>{s.table.events}</th><th>{s.table.orders}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/admin/members/${m.id}`}><b>{m.name}</b></Link></td>
                  <td>{m.email}</td>
                  <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}</td>
                  <td>{fmtWhen(m.lastActive)}</td>
                  <td>{m.eventCount}</td>
                  <td>{m.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AdminMemberTimeline() {
  const { p } = useLocale();
  const s = p.opsA.members;
  const { memberId } = useParams();
  const [events, setEvents] = useState(null);
  const [member, setMember] = useState(null);
  const [error, setError] = useState(null);
  const styleName = useStyleName();

  useEffect(() => {
    Promise.all([apiFetch(`/admin/members/${memberId}/timeline`), apiFetch("/admin/members")])
      .then(([tl, m]) => {
        setEvents(tl.events);
        setMember(m.members.find((x) => String(x.id) === String(memberId)) || null);
      })
      .catch((e) => setError(e instanceof ApiUnavailableError ? "demo" : "error"));
  }, [memberId]);

  if (error === "demo") return <p className="empty-note">{s.demoUnavailable}</p>;
  if (error) return <p className="empty-note">—</p>;
  if (!events) return <p className="page-sub">…</p>;

  return (
    <div>
      <p><Link to="/admin/members">← {s.back}</Link></p>
      <h2 className="panel-title">{s.timelineTitle(member?.name || `#${memberId}`)}</h2>
      {member && <p className="page-sub">{member.email} · {member.customerCode}</p>}
      {events.length === 0 ? <p className="empty-note">{s.emptyTimeline}</p> : (
        <table className="data-table">
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtWhen(e.createdAt)}</td>
                <td>{s.eventLabels[e.type] || e.type}</td>
                <td>
                  {e.entityType === "style" && e.entityId
                    ? <Link to={`/designs/${e.entityId}`}>{styleName(e.entityId)}</Link>
                    : (e.path || "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
