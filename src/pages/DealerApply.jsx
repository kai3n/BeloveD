import { useState } from "react";
import { submitApplication } from "../lib/store.js";
import { useLocale } from "../i18n.jsx";

export default function DealerApply() {
  const { p } = useLocale();
  const d = p.dealerApply;
  const [form, setForm] = useState({ bizName: "", contactName: "", email: "", city: "", permitNo: "", resaleCertNo: "", expectedQuarterlyUsd: "" });
  const [done, setDone] = useState(false);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function submit(e) {
    e.preventDefault();
    submitApplication({ ...form, expectedQuarterlyUsd: Number(form.expectedQuarterlyUsd) || 0 });
    setDone(true);
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{d.title}</h1>
        <div className="panel"><p className="form-hint" style={{ fontSize: 14 }}>{d.done}</p></div>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{d.title}</h1>
      <p className="page-sub">{d.sub}</p>
      <form className="panel form-stack" onSubmit={submit}>
        <label className="field"><span>{d.bizName}</span><input value={form.bizName} onChange={(e) => setF({ bizName: e.target.value })} required /></label>
        <label className="field"><span>{d.contactName}</span><input value={form.contactName} onChange={(e) => setF({ contactName: e.target.value })} required /></label>
        <label className="field"><span>{d.email}</span><input type="email" value={form.email} onChange={(e) => setF({ email: e.target.value })} required /></label>
        <label className="field"><span>{d.city}</span><input value={form.city} onChange={(e) => setF({ city: e.target.value })} required /></label>
        <label className="field"><span>{d.permitNo}</span><input value={form.permitNo} onChange={(e) => setF({ permitNo: e.target.value })} required /></label>
        <label className="field"><span>{d.resaleCertNo}</span><input value={form.resaleCertNo} onChange={(e) => setF({ resaleCertNo: e.target.value })} /></label>
        <label className="field"><span>{d.expected}</span><input type="number" step="1000" value={form.expectedQuarterlyUsd} onChange={(e) => setF({ expectedQuarterlyUsd: e.target.value })} /></label>
        <p className="form-hint">{d.note}</p>
        <button className="button primary" type="submit">{d.submit}</button>
      </form>
    </div>
  );
}
