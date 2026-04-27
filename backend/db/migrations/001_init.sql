-- Users + auth basics (minimal seedable schema)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null default 'student',
  password_hash text not null,
  must_reset_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

