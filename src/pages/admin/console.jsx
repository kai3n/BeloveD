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
