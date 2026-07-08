-- 라이브챗 CSAT — 대화 만족도(1~5)
alter table chat_threads add column if not exists csat int check (csat between 1 and 5);
