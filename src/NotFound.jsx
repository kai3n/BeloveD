import { useLocale } from "./i18n.jsx";

export default function NotFound() {
  const { p } = useLocale();
  return (
    <div className="page">
      <p className="empty-note">{p.common.notFound}</p>
    </div>
  );
}
