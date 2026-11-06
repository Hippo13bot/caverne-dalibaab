-- Portail public de demandes de prêt - La Caverne d'Alibaab
-- À exécuter une seule fois dans Supabase > SQL Editor, après SUPABASE.sql.
create extension if not exists pgcrypto;

create table if not exists public.caverne_public_catalog (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  catalog jsonb not null default '{"items":[],"kits":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.caverne_public_catalog enable row level security;
drop policy if exists "Public can view published Caverne catalogs" on public.caverne_public_catalog;
drop policy if exists "Owners manage their published Caverne catalog" on public.caverne_public_catalog;
create policy "Public can view published Caverne catalogs" on public.caverne_public_catalog for select to anon, authenticated using (true);
create policy "Owners manage their published Caverne catalog" on public.caverne_public_catalog for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select on public.caverne_public_catalog to anon, authenticated;
grant insert, update, delete on public.caverne_public_catalog to authenticated;

create table if not exists public.caverne_loan_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text not null default '',
  organization text not null default '',
  start_date date not null,
  end_date date not null,
  purpose text not null default '',
  notes text not null default '',
  requested_items jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested','cancelled')),
  admin_message text not null default '',
  converted_loan_id text,
  tracking_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caverne_request_dates check (end_date >= start_date)
);
alter table public.caverne_loan_requests add column if not exists converted_loan_id text;
create index if not exists caverne_requests_owner_created on public.caverne_loan_requests(owner_id, created_at desc);
create index if not exists caverne_requests_requester_created on public.caverne_loan_requests(requester_id, created_at desc);
alter table public.caverne_loan_requests enable row level security;
drop policy if exists "Owners read Caverne requests" on public.caverne_loan_requests;
drop policy if exists "Owners update Caverne requests" on public.caverne_loan_requests;
drop policy if exists "Requesters read their own Caverne requests" on public.caverne_loan_requests;
create policy "Owners read Caverne requests" on public.caverne_loan_requests for select to authenticated using (auth.uid() = owner_id);
create policy "Owners update Caverne requests" on public.caverne_loan_requests for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Requesters read their own Caverne requests" on public.caverne_loan_requests for select to authenticated using (auth.uid() = requester_id);
grant select, update on public.caverne_loan_requests to authenticated;
revoke all on public.caverne_loan_requests from anon;

create or replace function public.caverne_submit_loan_request(
  p_owner_id uuid, p_requester_name text, p_requester_email text, p_requester_phone text,
  p_organization text, p_start_date date, p_end_date date, p_purpose text, p_notes text, p_requested_items jsonb
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_token text; v_user uuid;
begin
  if p_end_date < p_start_date then raise exception 'La date de retour doit être après la date de retrait.'; end if;
  if length(trim(coalesce(p_requester_name,''))) < 2 or length(trim(coalesce(p_requester_email,''))) < 5 then raise exception 'Nom et e-mail obligatoires.'; end if;
  if jsonb_typeof(p_requested_items) <> 'array' or jsonb_array_length(p_requested_items)=0 then raise exception 'Ajoute au moins un équipement.'; end if;
  if not exists(select 1 from public.caverne_public_catalog where owner_id=p_owner_id) then raise exception 'Ce portail n’est pas encore activé.'; end if;
  v_user := auth.uid(); v_token := encode(gen_random_bytes(24),'hex');
  insert into public.caverne_loan_requests(owner_id, requester_id, requester_name, requester_email, requester_phone, organization, start_date, end_date, purpose, notes, requested_items, tracking_token_hash)
  values(p_owner_id,v_user,trim(p_requester_name),lower(trim(p_requester_email)),coalesce(p_requester_phone,''),coalesce(p_organization,''),p_start_date,p_end_date,coalesce(p_purpose,''),coalesce(p_notes,''),p_requested_items,encode(digest(v_token,'sha256'),'hex')) returning id into v_id;
  return jsonb_build_object('id',v_id,'tracking_token',v_token);
end; $$;
revoke all on function public.caverne_submit_loan_request(uuid,text,text,text,text,date,date,text,text,jsonb) from public;
grant execute on function public.caverne_submit_loan_request(uuid,text,text,text,text,date,date,text,text,jsonb) to anon, authenticated;

create or replace function public.caverne_track_loan_request(p_request_id uuid, p_tracking_token text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('id',id,'requester_name',requester_name,'start_date',start_date,'end_date',end_date,'purpose',purpose,'requested_items',requested_items,'status',status,'admin_message',admin_message,'created_at',created_at,'updated_at',updated_at)
  from public.caverne_loan_requests
  where id=p_request_id and tracking_token_hash=encode(digest(p_tracking_token,'sha256'),'hex')
  limit 1;
$$;
revoke all on function public.caverne_track_loan_request(uuid,text) from public;
grant execute on function public.caverne_track_loan_request(uuid,text) to anon, authenticated;
