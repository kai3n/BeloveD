import { useState } from "react";
import { addUser, getDB, listVendors, setVendorActive } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

// 벤더는 비밀번호 대신 접근 코드/매직링크로 로그인 — 어드민이 복사해 전달
const vendorLink = (code) => `${location.origin}${import.meta.env.BASE_URL}vendor?code=${code}`;

export default function AdminVendors() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.admin.vendors;
  const vendors = listVendors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState(null); // 방금 발급한 벤더(코드 노출용)

  function stats(supplierId) {
    const tasks = getDB().procurementReqs.filter((pr) => pr.supplierId === supplierId);
    return { assigned: tasks.length, proposals: tasks.filter((x) => x.status !== "open").length };
  }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{t.title} ({vendors.length})</h3>
        <table className="data-table">
          <thead><tr>
            <th>{t.displayName}</th><th>{t.emailCol}</th><th>{t.codeCol}</th>
            <th>{t.assigned}</th><th>{t.uploads}</th><th>{t.stateCol}</th>
          </tr></thead>
          <tbody>
            {vendors.map((v) => {
              const s = stats(v.id);
              return (
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.email}</td>
                  <td>
                    <code style={{ fontSize: 13, letterSpacing: 1 }}>{v.accessCode || "—"}</code>
                    {v.accessCode && <button className="chip" style={{ marginLeft: 8 }} onClick={() => navigator.clipboard?.writeText(vendorLink(v.accessCode))}>{t.copyLink}</button>}
                  </td>
                  <td>{s.assigned}</td><td>{s.proposals}</td>
                  <td>
                    <button className={`chip ${v.active ? "is-active" : ""}`} onClick={() => setVendorActive(v.id, !v.active)}>
                      {v.active ? t.active : t.suspended}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {issued && (
        <div className="panel" style={{ borderColor: "rgba(214,197,160,0.6)", background: "rgba(214,197,160,0.05)" }}>
          <h3>{t.issuedTitle(issued.name)}</h3>
          <p className="form-hint">{t.codeCol}: <code style={{ fontSize: 18, letterSpacing: 2, color: "var(--accent-bright)" }}>{issued.accessCode}</code></p>
          <p className="form-hint" style={{ wordBreak: "break-all" }}>{vendorLink(issued.accessCode)}</p>
          <button className="button secondary small" onClick={() => navigator.clipboard?.writeText(vendorLink(issued.accessCode))}>{t.copyLink}</button>
        </div>
      )}

      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); setIssued(addUser({ email, name, role: "supplier" })); setName(""); setEmail(""); }}>
        <h3>{t.issueTitle}</h3>
        <p className="form-hint">{t.issueHint}</p>
        <label className="field"><span>{t.nameLbl}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>{t.emailLbl}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <button className="button primary" type="submit">{t.issueBtn}</button>
      </form>
    </>
  );
}
