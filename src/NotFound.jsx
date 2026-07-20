import { Link } from "react-router-dom";
import { useLocale } from "./i18n.jsx";

export default function NotFound() {
  const { p } = useLocale();
  return (
    <div className="page page-narrow">
      <h1 className="page-title">404</h1>
      <p className="empty-note">{p.common.notFound}</p>
      <p style={{ marginTop: 18 }}><Link className="button primary" to="/">← BeloveD</Link></p>
    </div>
  );
}
