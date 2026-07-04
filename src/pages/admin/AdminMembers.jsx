// 회원·활동 대시보드 — KPI/인기 스타일/전환 퍼널 + 회원 목록 + 개인 타임라인.
// 데이터는 전부 실서버 API(/v1/admin/*) — 데모 빌드/서버 부재 시 안내만 보여준다.
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { pickI18n, useLocale } from "../../i18n.jsx";
import { getOpsStyle } from "../../lib/store.js";
import { getDesignSlotStyle } from "../../lib/designSlots.js";
import { ConsoleHead, StatStrip } from "./console.jsx";

// 퍼널 전환율 — 앞 단계 대비 %
function pct(part, whole) {
  if (!whole) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

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
    <>
      <ConsoleHead kicker={p.opsA.menu.members} title={s.title} />

      <StatStrip
        stats={[
          { value: kpi.sessionsToday, label: s.kpi.today },
          { value: kpi.sessions7d, label: s.kpi.sessions7d },
          { value: kpi.pageViews7d, label: s.kpi.pageViews7d },
          { value: kpi.activeMembers7d, label: s.kpi.active },
        ]}
      />

      <div className="con-section-label"><h3>{s.funnel.title}</h3></div>
      <div className="con-funnel">
        <div className="con-funnel-step">
          <strong>{funnel.styleViews}</strong>
          <span>{s.funnel.views}</span>
        </div>
        <div className="con-funnel-step">
          <strong>{funnel.intakeStarts}</strong>
          <span>{s.funnel.starts}</span>
          {pct(funnel.intakeStarts, funnel.styleViews) && <em>{pct(funnel.intakeStarts, funnel.styleViews)}</em>}
        </div>
        <div className="con-funnel-step">
          <strong>{funnel.intakeSubmits}</strong>
          <span>{s.funnel.submits}</span>
          {pct(funnel.intakeSubmits, funnel.intakeStarts) && <em>{pct(funnel.intakeSubmits, funnel.intakeStarts)}</em>}
        </div>
      </div>

      {topStyles.length > 0 && (
        <>
          <div className="con-section-label"><h3>{s.topStyles}</h3></div>
          <div className="con-table-panel">
            <table className="data-table">
              <tbody>
                {topStyles.map((row) => (
                  <tr key={row.entityId}>
                    <td><Link className="text-link" to={`/designs/${row.entityId}`}>{styleName(row.entityId)}</Link></td>
                    <td>{row.views} {s.views}</td>
                    <td>{row.clicks} {s.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {trend.length > 0 && (
        <>
          <div className="con-section-label"><h3>{s.trend}</h3></div>
          <div className="con-table-panel" style={{ padding: "18px 18px 14px" }}>
            <div className="con-trend" aria-hidden="true">
              {trend.map((t) => (
                <i key={t.day} title={`${t.day.slice(0, 10)} · ${t.pageViews}`}
                  style={{ height: `${Math.max((t.pageViews / maxTrend) * 100, 4)}%` }} />
              ))}
            </div>
            <div className="con-trend-range" aria-hidden="true">
              <span>{trend[0]?.day.slice(5, 10)}</span>
              <span>{trend[trend.length - 1]?.day.slice(5, 10)}</span>
            </div>
          </div>
        </>
      )}

      <div className="con-section-label"><h3>{p.opsA.menu.members}</h3><span className="con-count">{members.length}</span></div>
      <div className="con-table-panel">
        {members.length === 0 ? <p className="con-note">{s.emptyMembers}</p> : (
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
                  <td><Link className="text-link" to={`/bo-4q9z7m/analytics/${m.id}`}><b>{m.name}</b></Link></td>
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
    </>
  );
}

export function AdminMemberTimeline() {
  const { p } = useLocale();
  const s = p.opsA.members;
  const { memberId } = useParams();
  // 진입 경로 유지 — /analytics/:id에서 왔으면 애널리틱스 목록으로, /members/:id면 고객 목록으로
  const backTo = useLocation().pathname.includes("/analytics/") ? "/bo-4q9z7m/analytics" : "/bo-4q9z7m/members";
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
    <>
      <p style={{ margin: "0 0 14px" }}><Link className="text-link" to={backTo}>← {s.back}</Link></p>
      <ConsoleHead
        kicker={p.opsA.menu.members}
        title={s.timelineTitle(member?.name || `#${memberId}`)}
        sub={member ? `${member.email} · ${member.customerCode}` : undefined}
      />
      <div className="con-table-panel">
        {events.length === 0 ? <p className="con-note">{s.emptyTimeline}</p> : (
          <table className="data-table">
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtWhen(e.createdAt)}</td>
                  <td>{s.eventLabels[e.type] || e.type}</td>
                  <td>
                    {e.entityType === "style" && e.entityId
                      ? <Link className="text-link" to={`/designs/${e.entityId}`}>{styleName(e.entityId)}</Link>
                      : (e.path || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
