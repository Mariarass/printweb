-- Apply once to an existing Girl Prints database. The cover stays in `image`.
alter table public.gp_products
  add column if not exists images text[] not null default '{}';
