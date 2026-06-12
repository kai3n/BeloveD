import { useLocale } from "../../i18n.jsx";

export default function DealerPolicies() {
  const { p } = useLocale();
  const pol = p.dealer.policies;
  return (
    <>
      {pol.blocks.map(([title, body]) => (
        <div className="panel" key={title}>
          <h3>{title}</h3>
          <p className="form-hint" style={{ fontSize: 13.5 }}>{body}</p>
        </div>
      ))}
      <div className="panel">
        <h3>FTC</h3>
        <p className="form-hint" style={{ fontSize: 13.5 }}>{p.ftc}</p>
      </div>
    </>
  );
}
