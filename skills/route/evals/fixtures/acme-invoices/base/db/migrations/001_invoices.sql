create table invoices (id bigserial primary key, number text not null, customer text not null, total numeric not null, created_at timestamptz not null default now());
