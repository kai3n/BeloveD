import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { supplierTasks } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

// 같은 주문(jobCode)을 한 행으로 묶는다. 행을 펼치면 그 안의 개별 태스크(PR)들이 보인다.
function groupByJob(tasks) {
  const map = new Map();
  for (const task of tasks) {
    if (!map.has(task.jobCode)) map.set(task.jobCode, { jobCode: task.jobCode, styleRef: task.styleRef, requiredDate: task.requiredDate, tasks: [] });
    map.get(task.jobCode).tasks.push(task);
  }
  return [...map.values()]
    .map((j) => ({ ...j, tasks: [...j.tasks].sort((a, b) => b.id.localeCompare(a.id)), open: j.tasks.filter((x) => x.status === "open") }))
    // 처리할 작업이 있는 job을 위로
    .sort((a, b) => (b.open.length > 0) - (a.open.length > 0) || a.jobCode.localeCompare(b.jobCode));
}

export default function SupplierQueue() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.supplierP;
  const { user } = useAuth();
  const jobs = groupByJob(supplierTasks(user.id));

  // 처리 필요한 job은 펼친 상태로 시작, 전부 제출된 job은 한 행으로 접는다
  const [expanded, setExpanded] = useState(() => new Set(jobs.filter((j) => j.open.length > 0).map((j) => j.jobCode)));
  const toggle = (code) => setExpanded((s) => {
    const next = new Set(s);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub(user.name)}</p>

      {jobs.length === 0 ? <EmptyNote>{t.empty}</EmptyNote> : (
        <div className="form-stack">
          {jobs.map((job) => {
            const isOpen = expanded.has(job.jobCode);
            const action = job.open.length;
            return (
              <div key={job.jobCode} className="panel" style={{ padding: 0, overflow: "hidden" }}>
                <button type="button" onClick={() => toggle(job.jobCode)} aria-expanded={isOpen}
                  style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "16px 20px", background: "none", border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left", font: "inherit" }}>
                  <span style={{ color: "var(--muted)", width: 14 }}>{isOpen ? "▾" : "▸"}</span>
                  <strong style={{ minWidth: 92, letterSpacing: 0.5 }}>{job.jobCode}</strong>
                  <span style={{ minWidth: 90, color: "var(--muted)" }}>{job.styleRef || "—"}</span>
                  <span className="form-hint" style={{ flex: 1 }}>{job.requiredDate ? `${t.required}: ${job.requiredDate}` : ""}</span>
                  {action > 0
                    ? <span className="status-badge prt-open">{t.actionsNeeded(action)}</span>
                    : <span className="status-badge prt-submitted">{t.allSubmitted}</span>}
                  <span className="form-hint" style={{ minWidth: 64, textAlign: "right" }}>{t.taskCount(job.tasks.length)}</span>
                </button>

                {isOpen && (
                  <table className="data-table" style={{ borderTop: "1px solid var(--line)" }}>
                    <thead><tr><th>ID</th><th>{t.queue}</th><th>{t.due}</th><th>{p.common.status}</th><th /></tr></thead>
                    <tbody>
                      {job.tasks.map((task) => (
                        <tr key={task.id} style={task.status === "open" ? { background: "rgba(150,190,255,0.05)" } : undefined}>
                          <td>{task.id}</td>
                          <td>{t.taskTypes[task.type]}</td>
                          <td>{task.dueDate}{task.batchValidUntil && <span className="form-hint"><br />{t.batchUntil}: {task.batchValidUntil}</span>}</td>
                          <td><span className={`status-badge prt-${task.status}`}>{t.status[task.status]}</span></td>
                          <td>{task.status === "open"
                            ? <Link className="text-link" to={`/supplier/tasks/${task.id}`}>{t.openTask}</Link>
                            : <Link className="form-hint" to={`/supplier/tasks/${task.id}`}>{t.openTask}</Link>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
