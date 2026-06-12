import { useState } from "react";
import { addUser, getDB, listVendors, setVendorActive } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

export default function AdminVendors() {
  useDBVersion();
  const { p } = useLocale();
  const vendors = listVendors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function stats(supplierId) {
    const tasks = getDB().procurementReqs.filter((pr) => pr.supplierId === supplierId);
    return { assigned: tasks.length, proposals: tasks.filter((x) => x.status !== "open").length };
  }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{p.admin.vendors.title} ({vendors.length})</h3>
        <table className="data-table">
          <thead><tr>
            <th>{p.admin.vendors.displayName}</th><th>{p.admin.vendors.emailCol}</th>
            <th>{p.admin.vendors.assigned}</th><th>{p.admin.vendors.uploads}</th><th>{p.admin.vendors.stateCol}</th>
          </tr></thead>
          <tbody>
            {vendors.map((v) => {
              const s = stats(v.id);
              return (
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.email}</td><td>{s.assigned}</td><td>{s.proposals}</td>
                  <td>
                    <button className={`chip ${v.active ? "is-active" : ""}`} onClick={() => setVendorActive(v.id, !v.active)}>
                      {v.active ? p.admin.vendors.active : p.admin.vendors.suspended}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); addUser({ email, name, role: "supplier" }); setName(""); setEmail(""); }}>
        <h3>{p.admin.vendors.issueTitle}</h3>
        <label className="field"><span>{p.admin.vendors.nameLbl}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>{p.admin.vendors.emailLbl}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <button className="button primary" type="submit">{p.admin.vendors.issueBtn}</button>
      </form>
    </>
  );
}
