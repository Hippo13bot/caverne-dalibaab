-- Migration additive des étiquettes publiques vers EAN-13 + QR court.
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les anciennes colonnes, lignes, UUID et liens id=... restent compatibles.

create table if not exists public.caverne_public_labels (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  tag text not null,
  item_name text not null,
  brand text not null default '',
  model text not null default '',
  owner_name text not null default '',
  organization text not null default '',
  phone text not null default '',
  email text not null default '',
  updated_at timestamptz not null default now(),
  unique (owner_id, tag)
);

alter table public.caverne_public_labels add column if not exists public_code text;
alter table public.caverne_public_labels add column if not exists ean13 text;
create unique index if not exists caverne_public_labels_public_code_uidx
  on public.caverne_public_labels(public_code) where public_code is not null;
create unique index if not exists caverne_public_labels_ean13_uidx
  on public.caverne_public_labels(ean13) where ean13 is not null;

alter table public.caverne_public_labels enable row level security;
drop policy if exists "Public can read published equipment labels" on public.caverne_public_labels;
drop policy if exists "Owners can publish their equipment labels" on public.caverne_public_labels;
drop policy if exists "Owners can update their equipment labels" on public.caverne_public_labels;
create policy "Public can read published equipment labels"
  on public.caverne_public_labels for select to anon, authenticated using (true);
create policy "Owners can publish their equipment labels"
  on public.caverne_public_labels for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update their equipment labels"
  on public.caverne_public_labels for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select on public.caverne_public_labels to anon, authenticated;
grant insert, update on public.caverne_public_labels to authenticated;
