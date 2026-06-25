import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const startModes = [
  {
    key: "design",
    label: "Start with a design",
    title: "Design first",
    body: "Best for most custom jewelry. Choose the piece, then let BeloveD recommend the lab diamond range.",
  },
  {
    key: "diamond",
    label: "Start with a diamond",
    title: "Diamond first",
    body: "Best for solitaire rings, studs, and pendant orders where the center stone drives the piece.",
  },
  {
    key: "recommend",
    label: "Recommend for me",
    title: "Recommend for me",
    body: "Best when the customer knows the occasion, budget, and taste but does not want to compare specs.",
  },
];

const copyByMode = {
  design: {
    firstField: "Selected style",
    firstValue: "Solitaire Ring (6-prong)",
    secondField: "Diamond handling",
    secondValue: "Recommend stones after design",
    note: "Default path. The customer starts from the accessory and keeps diamond control optional.",
  },
  diamond: {
    firstField: "Center stone",
    firstValue: "Round · 1.5 ct · E-F · VS+",
    secondField: "Setting direction",
    secondValue: "Show compatible designs",
    note: "Use this path for shoppers who already care about carat, shape, or certification.",
  },
  recommend: {
    firstField: "Customer brief",
    firstValue: "Budget, occasion, preferred style",
    secondField: "BeloveD output",
    secondValue: "Design + diamond shortlist",
    note: "This keeps the flow premium and concierge-led without hiding the stone decision.",
  },
};

export default function CustomBuilderMockup() {
  const [mode, setMode] = useState("design");
  const activeMode = useMemo(() => startModes.find((item) => item.key === mode) || startModes[0], [mode]);
  const activeCopy = copyByMode[mode];
  const steps = ["Design", "Diamond option", "Details", "Review"];

  return (
    <div className="page page-narrow mock-builder-simple">
      <h1 className="page-title">Custom Order Request</h1>
      <p className="page-sub">
        Start with the accessory by default. Let customers open diamond control only when it matters.
      </p>

      <ol className="stepper">
        {steps.map((step, i) => (
          <li key={step} className={i === 0 ? "current" : ""}><span className="dot" />{step}</li>
        ))}
      </ol>
      <p className="form-hint intake-meta-note">Recommended structure · No payment until quote accepted</p>

      <div className="intake-layout has-edu">
        <section className="panel form-stack">
          <div>
            <p className="section-label">HOW SHOULD THIS START?</p>
            <h3 className="mock-simple-heading">{activeMode.title}</h3>
            <p className="form-hint mock-simple-copy">{activeMode.body}</p>
          </div>

          <div className="mock-start-switch" aria-label="Choose starting mode">
            {startModes.map((item) => (
              <button
                key={item.key}
                type="button"
                className={mode === item.key ? "is-active" : ""}
                onClick={() => setMode(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Product category</span>
              <select defaultValue="ring">
                <option value="ring">Ring</option>
                <option value="necklace">Necklace / Pendant</option>
                <option value="earrings">Earrings</option>
                <option value="bracelet">Bracelet</option>
              </select>
            </label>
            <label className="field">
              <span>Budget range</span>
              <select defaultValue="2500">
                <option value="1500">$1,500 - $2,500</option>
                <option value="2500">$2,500 - $4,000</option>
                <option value="5000">$4,000 - $7,000</option>
                <option value="open">Flexible</option>
              </select>
            </label>
            <label className="field">
              <span>{activeCopy.firstField}</span>
              <input value={activeCopy.firstValue} readOnly />
            </label>
            <label className="field">
              <span>{activeCopy.secondField}</span>
              <input value={activeCopy.secondValue} readOnly />
            </label>
          </div>

          <div className="panel mock-simple-note">
            <p className="form-hint">{activeCopy.note}</p>
          </div>

          <div className="wizard-nav">
            <Link className="button secondary" to="/designs">Back to designs</Link>
            <Link className="button primary" to="/custom/new">Continue</Link>
          </div>
        </section>

        <aside className="stone-edu-aside panel mock-simple-aside">
          <p className="stone-edu-kicker">BeloveD recommendation</p>
          <h3>Keep the diamond choice optional.</h3>
          <p className="stone-edu-body">
            Most buyers should choose the accessory first. For solitaire, pendant, and studs,
            let them open diamond specs as a focused optional step.
          </p>
          <p className="stone-edu-guide">
            Default CTA: Start with a design.
            Secondary CTA: Start with a diamond.
            Soft CTA: Recommend for me.
          </p>
        </aside>
      </div>
    </div>
  );
}
