// 콘솔 공통 크롬 — 모든 어드민 페이지가 같은 헤더/스탯 문법을 쓴다.
export function ConsoleHead({ kicker, title, sub, children }) {
  return (
    <header className="con-head">
      <div className="con-head-copy">
        {kicker && <p className="con-kicker">{kicker}</p>}
        <h2 className="con-title">{title}</h2>
        {sub && <p className="con-sub">{sub}</p>}
      </div>
      {children && <div className="con-head-actions">{children}</div>}
    </header>
  );
}

// 테이블 페이저 — 페이지가 1장이면 렌더하지 않는다
export function Pager({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null;
  return (
    <div className="con-pager">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      <span>{page} / {pageCount}</span>
      <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

export function StatStrip({ stats }) {
  return (
    <div className="con-stats">
      {stats.map(({ value, label }) => (
        <div className="con-stat" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
