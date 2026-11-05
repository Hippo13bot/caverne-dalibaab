-- La Caverne d'Alibaab : table privée de synchronisation
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Chaque compte ne peut lire et modifier que sa propre sauvegarde.

create table if not exists public.caverne_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.caverne_state enable row level security;

-- Supprime les anciennes politiques portant ces noms pour permettre de relancer le script.
drop policy if exists "Users can read their own Caverne state" on public.caverne_state;
drop policy if exists "Users can insert their own Caverne state" on public.caverne_state;
drop policy if exists "Users can update their own Caverne state" on public.caverne_state;

create policy "Users can read their own Caverne state"
  on public.caverne_state for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Users can insert their own Caverne state"
  on public.caverne_state for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update their own Caverne state"
  on public.caverne_state for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

 grant select, insert, update on public.caverne_state to authenticated;
