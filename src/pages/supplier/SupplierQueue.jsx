import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { supplierTasks } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

export default function SupplierQueue() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.supplierP;
  const { user } = useAuth();
  const tasks = supplierTasks(user.id);

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub(user.name)}</p>

      {tasks.length === 0 ? <EmptyNote>{t.empty}</EmptyNote> : (
        <table className="data-table">
          <thead><tr><th>ID</th><th>{t.queue}</th><th>{t.styleRef}</th><th>{t.due}</th><th>{t.required}</th><th>{p.common.status}</th><th /></tr></thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.id}</td>
                <td>{t.taskTypes[task.type]}</td>
                <td>{task.styleRef || "—"}</td>
                <td>{task.dueDate}{task.batchValidUntil && <span className="form-hint"><br />{t.batchUntil}: {task.batchValidUntil}</span>}</td>
                <td>{task.requiredDate || "—"}</td>
                <td><span className={`status-badge prt-${task.status}`}>{t.status[task.status]}</span></td>
                <td><Link className="text-link" to={`/supplier/tasks/${task.id}`}>{t.openTask}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
