-- Étiquettes QR publiques de La Caverne d'Alibaab
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Seules les fiches explicitement publiées depuis l'application sont accessibles publiquement.

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

alter table public.caverne_public_labels enable row level security;

drop policy if exists "Public can read published equipment labels" on public.caverne_public_labels;
drop policy if exists "Owners can publish their equipment labels" on public.caverne_public_labels;
drop policy if exists "Owners can update their equipment labels" on public.caverne_public_labels;

-- Les lignes de cette table sont publiques par conception : ne publier que les contacts consentis.
create policy "Public can read published equipment labels"
  on public.caverne_public_labels for select
  to anon, authenticated
  using (true);

create policy "Owners can publish their equipment labels"
  on public.caverne_public_labels for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update their equipment labels"
  on public.caverne_public_labels for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select on public.caverne_public_labels to anon, authenticated;
grant insert, update on public.caverne_public_labels to authenticated;
