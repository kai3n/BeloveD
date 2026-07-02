// 9 benchmark shapes — simple outline silhouettes (viewBox 0 0 48 48)
window.DIAMOND_SHAPES = {
  round: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><path d="M24 7v34M7 24h34M12 12l24 24M36 12L12 36" opacity=".45"/></svg>',
  oval: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="12.5" ry="18"/><path d="M24 6v36M11.5 24h25" opacity=".45"/></svg>',
  princess: '<svg viewBox="0 0 48 48"><rect x="9" y="9" width="30" height="30"/><path d="M9 9l30 30M39 9L9 39" opacity=".45"/></svg>',
  emerald: '<svg viewBox="0 0 48 48"><path d="M15 8h18l7 7v18l-7 7H15l-7-7V15z"/><path d="M18 12h12l6 6v12l-6 6H18l-6-6V18z" opacity=".45"/></svg>',
  pear: '<svg viewBox="0 0 48 48"><path d="M24 6C29 15 37 20 37 29a13 13 0 0 1-26 0C11 20 19 15 24 6z"/><path d="M24 6v36" opacity=".45"/></svg>',
  marquise: '<svg viewBox="0 0 48 48"><path d="M24 5c8 7 12 13 12 19s-4 12-12 19c-8-7-12-13-12-19S16 12 24 5z"/><path d="M24 5v38" opacity=".45"/></svg>',
  cushion: '<svg viewBox="0 0 48 48"><rect x="9" y="9" width="30" height="30" rx="9"/><path d="M11 11l26 26M37 11L11 37" opacity=".45"/></svg>',
  radiant: '<svg viewBox="0 0 48 48"><path d="M15 9h18l6 6v18l-6 6H15l-6-6V15z"/><path d="M9 15L24 24 39 15M9 33l15-9 15 9" opacity=".45"/></svg>',
  asscher: '<svg viewBox="0 0 48 48"><path d="M16 9h16l7 7v16l-7 7H16l-7-7V16z"/><path d="M19 13h10l6 6v10l-6 6H19l-6-6V19z" opacity=".45"/></svg>',
};
window.SHAPE_LABELS = {
  round: "Round", oval: "Oval", princess: "Princess", emerald: "Emerald", pear: "Pear",
  marquise: "Marquise", cushion: "Cushion", radiant: "Radiant", asscher: "Asscher",
};
