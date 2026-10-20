-- Run in the NEW Supabase project's SQL editor. No original shop tables are used.
create table if not exists public.gp_products (
  id text primary key,
  title text not null check (length(title) between 1 and 150),
  description text not null default '',
  image text not null,
  images text[] not null default '{}',
  category text not null check (category in ('Dreamy', 'Coquette', 'Y2K')),
  active boolean not null default false,
  sort_order integer not null default 0
);
-- Also upgrades an existing Girl Prints catalog without changing its cover images.
alter table public.gp_products add column if not exists images text[] not null default '{}';
create table if not exists public.gp_variants (
  id text primary key,
  product_id text not null references public.gp_products(id),
  size text not null,
  price_cents integer not null check (price_cents > 0 and price_cents <= 1000000),
  active boolean not null default false
);
create table if not exists public.gp_orders (
  session_id text primary key,
  reference text not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('paid','shipped','delivered','refunded')),
  currency text not null check (currency = 'usd'),
  lines jsonb not null,
  subtotal_cents integer not null,
  tax_cents integer not null,
  shipping_cents integer not null,
  total_cents integer not null,
  customer_email text not null,
  customer_name text,
  shipping jsonb,
  payment_intent text,
  customer_email_sent boolean not null default false,
  owner_email_sent boolean not null default false,
  email_lease uuid,
  email_lease_until timestamptz
);
create table if not exists public.gp_contact_limits (
  identifier text primary key,
  window_start timestamptz not null,
  count integer not null
);
alter table public.gp_products enable row level security;
alter table public.gp_variants enable row level security;
alter table public.gp_orders enable row level security;
alter table public.gp_contact_limits enable row level security;
-- Only server-side service_role can access these tables.
revoke all on public.gp_products, public.gp_variants, public.gp_orders, public.gp_contact_limits from anon, authenticated;
grant all on public.gp_products, public.gp_variants, public.gp_orders, public.gp_contact_limits to service_role;

create or replace function public.gp_allow_contact(identifier text)
returns boolean language plpgsql security definer set search_path = public as $$
declare new_count integer;
begin
  -- Bound storage; identifiers are salted hashes, never raw email addresses.
  delete from public.gp_contact_limits where window_start < now() - interval '2 days';
  insert into public.gp_contact_limits as limits (identifier, window_start, count)
  values ($1, now(), 1)
  on conflict on constraint gp_contact_limits_pkey do update set
    count = case when limits.window_start < now() - interval '1 hour' then 1 else limits.count + 1 end,
    window_start = case when limits.window_start < now() - interval '1 hour' then now() else limits.window_start end
  returning count into new_count;
  return new_count <= 3;
end;
$$;
revoke all on function public.gp_allow_contact(text) from public, anon, authenticated;
grant execute on function public.gp_allow_contact(text) to service_role;
