create sequence if not exists admin_style_code_seq start 1001;

create index if not exists starter_designs_category_published_idx
  on starter_designs (category, published, sort_order, style_code);
