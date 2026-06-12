import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { createRequest, getDiamond, getTemplate, listDiamonds, listTemplates } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, Stepper, usd } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const METALS = ["wg18", "yg18", "rg18", "pt950"];

export default function CustomWizard() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(params.get("template"));
  const [diamondId, setDiamondId] = useState(params.get("diamond"));
  const [details, setDetails] = useState({ metal: METALS[0], size: "", engraving: "", budget: "", notes: "" });
  const setD = (patch) => setDetails((d) => ({ ...d, ...patch }));

  const steps = p.wizard.steps.map((label, i) => ({ key: i, label }));
  const template = templateId ? getTemplate(templateId) : null;
  const diamond = diamondId ? getDiamond(diamondId) : null;
  const estimate = (template?.basePriceUsd || 0) + (diamond?.priceUsd || 0);

  function submit() {
    if (!user) return navigate("/login", { state: { from: "/custom/new" } });
    const request = createRequest({ customerId: user.id, templateId, diamondId, details: { ...details, budget: Number(details.budget) || null } });
    navigate(`/account/requests/${request.id}`, { state: { submitted: true } });
  }

  return (
    <div className="page">
      <h1 className="page-title">{p.wizard.title}</h1>
      <p className="page-sub">{p.wizard.sub}</p>
      <Stepper steps={steps} currentIndex={step} />

      {step === 0 && (
        <section style={{ marginTop: 38 }}>
          <div className="card-grid cols-3">
            {listTemplates().map((t) => (
              <button key={t.id} className={`item-card select-card ${templateId === t.id ? "is-selected" : ""}`} onClick={() => setTemplateId(t.id)}>
                <MediaThumb media={t.media[0]} ratio="1 / 1.05" alt={pickI18n(t.name, locale)} />
                <div className="card-body">
                  <h3>{pickI18n(t.name, locale)}</h3>
                  <p className="spec">{p.categories[t.category]}</p>
                  <p className="price">{t.basePriceUsd > 0 ? p.templates.fromPrice(usd(t.basePriceUsd)) : p.templates.quote}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="wizard-nav">
            <span />
            <button className="button primary" disabled={!templateId} onClick={() => setStep(1)}>{p.common.next}</button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section style={{ marginTop: 38 }}>
          <p className="form-hint">{p.wizard.skipHint}</p>
          <div className="card-grid" style={{ marginTop: 18 }}>
            {listDiamonds().map((d) => (
              <button key={d.id} className={`item-card select-card ${diamondId === d.id ? "is-selected" : ""}`}
                onClick={() => setDiamondId(diamondId === d.id ? null : d.id)}>
                <MediaThumb media={d.media[0]} alt={`${p.shapes[d.shape]} ${d.carat}ct`} />
                <div className="card-body">
                  <h3>{p.shapes[d.shape]} {d.carat.toFixed(1)}ct</h3>
                  <p className="spec">{d.cut} · {d.color} · {d.clarity} · {d.certOrg}</p>
                  <p className="price">{usd(d.priceUsd)}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(0)}>{p.common.prev}</button>
            <button className="button primary" onClick={() => setStep(2)}>{diamondId ? p.common.next : p.wizard.nextNoStone}</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel form-stack" style={{ marginTop: 38, maxWidth: 560 }}>
          <label className="field"><span>{p.wizard.metal}</span>
            <select value={details.metal} onChange={(e) => setD({ metal: e.target.value })}>
              {METALS.map((m) => <option key={m} value={m}>{p.metals[m]}</option>)}
            </select></label>
          <label className="field"><span>{p.wizard.size}</span>
            <input value={details.size} onChange={(e) => setD({ size: e.target.value })} placeholder={p.wizard.sizePh} /></label>
          <label className="field"><span>{p.wizard.engraving}</span>
            <input value={details.engraving} onChange={(e) => setD({ engraving: e.target.value })} maxLength={20} /></label>
          <label className="field"><span>{p.wizard.budget}</span>
            <input type="number" step="100" value={details.budget} onChange={(e) => setD({ budget: e.target.value })} /></label>
          <label className="field"><span>{p.wizard.notes}</span>
            <textarea value={details.notes} onChange={(e) => setD({ notes: e.target.value })} placeholder={p.wizard.notesPh} /></label>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(1)}>{p.common.prev}</button>
            <button className="button primary" disabled={!details.size} onClick={() => setStep(3)}>{p.common.next}</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel" style={{ marginTop: 38, maxWidth: 640 }}>
          <h3>{p.wizard.summary}</h3>
          <table className="data-table"><tbody>
            <tr><th>{p.wizard.design}</th><td>{pickI18n(template?.name, locale)}</td></tr>
            <tr><th>{p.wizard.diamond}</th><td>{diamond ? `${p.shapes[diamond.shape]} ${diamond.carat.toFixed(1)}ct ${diamond.color}/${diamond.clarity} (${usd(diamond.priceUsd)})` : p.wizard.recommend}</td></tr>
            <tr><th>{p.wizard.metalSize}</th><td>{p.metals[details.metal]} / {details.size}</td></tr>
            {details.engraving && <tr><th>{p.wizard.engraving}</th><td>{details.engraving}</td></tr>}
            {details.budget && <tr><th>{p.wizard.budget}</th><td>{usd(details.budget)}</td></tr>}
            {details.notes && <tr><th>{p.wizard.notes}</th><td>{details.notes}</td></tr>}
            <tr><th>{p.wizard.expected}</th><td className="price">{estimate > 0 ? `${usd(estimate)}~` : p.wizard.quoteLater}</td></tr>
          </tbody></table>
          <p className="form-hint" style={{ marginTop: 14 }}>{p.wizard.submitNote}</p>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(2)}>{p.common.prev}</button>
            {user
              ? <button className="button primary" onClick={submit}>{p.wizard.submit}</button>
              : <Link className="button primary" to="/login" state={{ from: "/custom/new" }}>{p.wizard.loginToSubmit}</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
