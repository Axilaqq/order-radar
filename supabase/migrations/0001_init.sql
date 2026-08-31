-- Order Radar — схема базы. Выполнять в Supabase → SQL Editor.

create table if not exists public.orders (
  id            bigserial primary key,
  source_id     text        not null,
  external_id   text        not null,
  title         text        not null,
  url           text,
  description   text,
  budget        text,
  score         integer     not null default 0,
  tags          text[]      not null default '{}',
  status        text        not null default 'new',   -- new | sent | skipped | applied | rejected
  published_at  timestamptz,
  found_at      timestamptz not null default now(),
  sent_at       timestamptz,
  raw           jsonb,
  constraint orders_source_external_uniq unique (source_id, external_id)
);

create index if not exists orders_found_at_idx on public.orders (found_at desc);
create index if not exists orders_status_idx   on public.orders (status);
create index if not exists orders_score_idx    on public.orders (score desc);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

create table if not exists public.runs (
  id          bigserial primary key,
  started_at  timestamptz not null,
  finished_at timestamptz,
  new_orders  integer not null default 0,
  notified    integer not null default 0,
  errors      text
);

create index if not exists runs_started_at_idx on public.runs (started_at desc);

-- Доступ только по service_role ключу (он используется воркером и обходит RLS).
-- RLS включаем, политик не создаём — значит анонимный ключ не прочитает ничего.
alter table public.orders   enable row level security;
alter table public.settings enable row level security;
alter table public.runs     enable row level security;

insert into public.settings (key, value)
values ('paused', 'false'::jsonb)
on conflict (key) do nothing;
