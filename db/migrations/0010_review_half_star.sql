-- 하프스타 별점 — 0.5 단위 허용 (int → numeric(2,1)), 체크는 1~5 + 0.5 스텝 강제
alter table customer_reviews
  drop constraint customer_reviews_rating_check;

alter table customer_reviews
  alter column rating drop default,
  alter column rating type numeric(2,1),
  alter column rating set default 5,
  add constraint customer_reviews_rating_check
    check (rating between 1 and 5 and rating * 2 = trunc(rating * 2));
