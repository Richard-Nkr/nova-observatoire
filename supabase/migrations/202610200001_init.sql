-- =============================================================================
-- NOVA OBSERVATOIRE — schéma PostgreSQL / PostGIS et politiques RLS
-- Migration initiale : 2026-10-20
--
-- Cette migration prépare le passage du mode démonstration (localStorage) à
-- Supabase. Elle n'est pas exécutée par l'application Vercel de démonstration.
--
-- Principes :
--   * aucune valeur numérique n'est obligatoire : l'absence reste l'absence ;
--   * chaque valeur métier porte une source, une date et un niveau de fiabilité ;
--   * N1 (observé) ne peut jamais être écrasée par N2 (recherche) ou N3 (estimé) ;
--   * l'historique des KPI et le journal d'audit sont conservés.
-- =============================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types métier
-- -----------------------------------------------------------------------------
create type public.hotel_category as enum ('1', '2', '3', '4', '5', 'Palace');
create type public.hotel_gamme as enum ('Économique', 'Milieu de gamme', 'Upscale', 'Luxe');
create type public.hotel_type as enum ('Business', 'Loisirs', 'Resort', 'Boutique', 'Patrimonial');
create type public.hotel_exploitation as enum ('Indépendant', 'Franchise', 'Contrat de gestion', 'Intégré');
create type public.reliability_level as enum ('N1', 'N2', 'N3');
create type public.user_role as enum ('Lecteur', 'Contributeur', 'Admin');
create type public.deal_type as enum ('Murs', 'Fonds', 'Murs et fonds');
create type public.pipeline_status as enum ('En construction', 'Permis accordé', 'Annoncé', 'Rénovation');
create type public.task_priority as enum ('Haute', 'Moyenne', 'Basse');
create type public.task_status as enum ('À faire', 'En cours', 'Fait');

-- -----------------------------------------------------------------------------
-- Profils et rôles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null default '',
  email text,
  initiales text,
  role public.user_role not null default 'Lecteur',
  acces_confidentiel boolean not null default false,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif rattaché à auth.users. Le rôle Admin implique l’accès confidentiel.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, email, initiales)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'NA'), 2))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Fonctions d'aide RLS (security definer pour éviter la récursion de policy).
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and actif;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'Admin', false);
$$;

create or replace function public.is_contributor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('Contributeur', 'Admin'), false);
$$;

create or replace function public.has_confidential_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and actif
        and (role = 'Admin' or acces_confidentiel)
    ),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Hôtels
-- -----------------------------------------------------------------------------
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  groupe text,
  enseigne text,
  adresse text,
  code_postal text,
  ville text not null,
  departement text,
  region text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(Point, 4326) not null,
  categorie public.hotel_category not null,
  gamme public.hotel_gamme,
  type public.hotel_type,
  exploitation public.hotel_exploitation,
  proprietaire text,
  exploitant text,
  annee_ouverture integer check (annee_ouverture between 1800 and 2100),
  annee_renovation integer check (annee_renovation between 1800 and 2100),
  cles integer check (cles is null or cles >= 0),
  suites integer check (suites is null or suites >= 0),
  surface_totale numeric check (surface_totale is null or surface_totale >= 0),
  surface_hebergement numeric check (surface_hebergement is null or surface_hebergement >= 0),
  surface_fnb numeric check (surface_fnb is null or surface_fnb >= 0),
  surface_mice numeric check (surface_mice is null or surface_mice >= 0),
  nb_salles_seminaire integer check (nb_salles_seminaire is null or nb_salles_seminaire >= 0),
  capacite_mice_max integer check (capacite_mice_max is null or capacite_mice_max >= 0),
  equipements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(equipements) = 'object'),
  photo_url text,
  site_url text,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_hypothese_required_n3
    check (source_fiabilite <> 'N3' or coalesce(length(trim(source_hypothese)), 0) > 0)
);

comment on table public.hotels is
  'Fiches hôtels géolocalisées. equipements reprend les booléens et surfaces de l’interface.';

create index hotels_location_idx on public.hotels using gist (location);
create index hotels_region_idx on public.hotels (region);
create index hotels_ville_idx on public.hotels (ville);
create index hotels_categorie_idx on public.hotels (categorie);
create index hotels_cles_idx on public.hotels (cles);
create index hotels_equipements_idx on public.hotels using gin (equipements);

create or replace function public.set_hotel_location()
returns trigger
language plpgsql
as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$;

create trigger hotels_location
before insert or update of latitude, longitude on public.hotels
for each row execute function public.set_hotel_location();

-- -----------------------------------------------------------------------------
-- KPI annuels et historique
-- -----------------------------------------------------------------------------
create table public.hotel_kpis (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  annee integer not null check (annee between 1900 and 2100),
  ca_total numeric,
  ca_hebergement numeric,
  ca_fnb numeric,
  ca_autres numeric,
  taux_occupation numeric check (taux_occupation is null or taux_occupation between 0 and 1),
  adr numeric check (adr is null or adr >= 0),
  revpar numeric check (revpar is null or revpar >= 0),
  ebitda numeric,
  ebitda_pct numeric,
  gop numeric,
  effectif integer check (effectif is null or effectif >= 0),
  note numeric check (note is null or note between 0 and 10),
  nb_avis integer check (nb_avis is null or nb_avis >= 0),
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, annee),
  constraint kpi_hypothese_required_n3
    check (source_fiabilite <> 'N3' or coalesce(length(trim(source_hypothese)), 0) > 0)
);

create index hotel_kpis_hotel_idx on public.hotel_kpis (hotel_id);
create index hotel_kpis_annee_idx on public.hotel_kpis (annee);

create table public.hotel_kpi_history (
  history_id uuid primary key default gen_random_uuid(),
  original_id uuid,
  hotel_id uuid not null,
  annee integer not null,
  ca_total numeric,
  ca_hebergement numeric,
  ca_fnb numeric,
  ca_autres numeric,
  taux_occupation numeric,
  adr numeric,
  revpar numeric,
  ebitda numeric,
  ebitda_pct numeric,
  gop numeric,
  effectif integer,
  note numeric,
  nb_avis integer,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  archived_at timestamptz not null default now(),
  archived_by uuid default auth.uid()
);

create index hotel_kpi_history_hotel_idx on public.hotel_kpi_history (hotel_id, annee);

-- Vérifie la règle de conflit et archive l'ancienne valeur avant remplacement.
create or replace function public.enforce_kpi_reliability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case old.source_fiabilite when 'N1' then 1 when 'N2' then 2 else 3 end;
  new_rank := case new.source_fiabilite when 'N1' then 1 when 'N2' then 2 else 3 end;

  if old_rank < new_rank then
    raise exception
      'Conflit de fiabilité : une valeur % ne peut pas remplacer une valeur %.',
      new.source_fiabilite, old.source_fiabilite
      using errcode = 'check_violation';
  end if;

  insert into public.hotel_kpi_history (
    original_id, hotel_id, annee,
    ca_total, ca_hebergement, ca_fnb, ca_autres,
    taux_occupation, adr, revpar, ebitda, ebitda_pct, gop,
    effectif, note, nb_avis,
    source_source, source_date, source_auteur, source_fiabilite, source_hypothese
  ) values (
    old.id, old.hotel_id, old.annee,
    old.ca_total, old.ca_hebergement, old.ca_fnb, old.ca_autres,
    old.taux_occupation, old.adr, old.revpar, old.ebitda, old.ebitda_pct, old.gop,
    old.effectif, old.note, old.nb_avis,
    old.source_source, old.source_date, old.source_auteur, old.source_fiabilite, old.source_hypothese
  );

  return new;
end;
$$;

create trigger hotel_kpis_reliability
before update on public.hotel_kpis
for each row execute function public.enforce_kpi_reliability();

-- -----------------------------------------------------------------------------
-- Transactions
-- -----------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  date_transaction date not null,
  acheteur text,
  vendeur text,
  prix numeric check (prix is null or prix >= 0),
  prix_par_cle numeric check (prix_par_cle is null or prix_par_cle >= 0),
  type public.deal_type not null,
  ca_avant numeric,
  ca_apres numeric,
  confidentiel_client boolean not null default false,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_hotel_idx on public.transactions (hotel_id);
create index transactions_date_idx on public.transactions (date_transaction);
create index transactions_confidentiel_idx on public.transactions (confidentiel_client);

-- -----------------------------------------------------------------------------
-- Pipeline
-- -----------------------------------------------------------------------------
create table public.pipeline_projects (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text not null,
  region text not null,
  categorie public.hotel_category not null,
  cles integer check (cles is null or cles >= 0),
  ouverture integer check (ouverture between 1900 and 2100),
  statut public.pipeline_status not null,
  promoteur text,
  source_source text,
  source_date date,
  source_auteur text,
  source_fiabilite public.reliability_level,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Sélections, benchmarks, imports, tâches
-- -----------------------------------------------------------------------------
create table public.saved_selections (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  filters jsonb not null default '{}'::jsonb,
  hotel_ids uuid[] not null default '{}',
  partage boolean not null default false,
  auteur_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  client text,
  mission text,
  date_mission date,
  consultant_id uuid references public.profiles (id) on delete set null,
  consultant_nom text,
  annee integer not null check (annee between 1900 and 2100),
  panel_ids uuid[] not null default '{}',
  reference_id uuid references public.hotels (id) on delete set null,
  kpis text[] not null default '{}',
  secteurs jsonb not null default '[]'::jsonb,
  notes text,
  confidentiel_client boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  fichier text not null,
  date_import timestamptz not null default now(),
  auteur_id uuid references public.profiles (id) on delete set null,
  auteur_nom text,
  lignes integer not null default 0,
  crees integer not null default 0,
  fusionnes integer not null default 0,
  ignores integer not null default 0,
  statut text not null default 'Terminé' check (statut in ('Terminé', 'En revue')),
  mapping jsonb not null default '{}'::jsonb
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels (id) on delete cascade,
  hotel_nom text not null,
  champ text not null,
  region text,
  assignee_id uuid references public.profiles (id) on delete set null,
  priorite public.task_priority not null default 'Moyenne',
  statut public.task_status not null default 'À faire',
  echeance date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_statut_idx on public.tasks (statut);
create index tasks_assignee_idx on public.tasks (assignee_id);

-- -----------------------------------------------------------------------------
-- Journal d'audit (ajout seul)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text,
  details text,
  confidential boolean not null default false,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_user_idx on public.audit_log (user_id);

create or replace function public.forbid_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Le journal d’audit est en ajout seul.' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function public.forbid_audit_mutation();

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger hotels_touch before update on public.hotels
for each row execute function public.touch_updated_at();
create trigger hotel_kpis_touch before update on public.hotel_kpis
for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions
for each row execute function public.touch_updated_at();
create trigger saved_selections_touch before update on public.saved_selections
for each row execute function public.touch_updated_at();
create trigger benchmarks_touch before update on public.benchmarks
for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks
for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_kpis enable row level security;
alter table public.hotel_kpi_history enable row level security;
alter table public.transactions enable row level security;
alter table public.pipeline_projects enable row level security;
alter table public.saved_selections enable row level security;
alter table public.benchmarks enable row level security;
alter table public.import_batches enable row level security;
alter table public.tasks enable row level security;
alter table public.audit_log enable row level security;

-- Profils : lecture par les membres, administration réservée aux admins.
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Hôtels : lecture pour tous les membres, écriture contributeur/admin.
create policy hotels_read on public.hotels
  for select to authenticated using (true);
create policy hotels_insert on public.hotels
  for insert to authenticated with check (public.is_contributor());
create policy hotels_update on public.hotels
  for update to authenticated using (public.is_contributor()) with check (public.is_contributor());
create policy hotels_delete on public.hotels
  for delete to authenticated using (public.is_admin());

-- KPI : lecture membres, écriture contributeur/admin.
create policy kpis_read on public.hotel_kpis
  for select to authenticated using (true);
create policy kpis_insert on public.hotel_kpis
  for insert to authenticated with check (public.is_contributor());
create policy kpis_update on public.hotel_kpis
  for update to authenticated using (public.is_contributor()) with check (public.is_contributor());
create policy kpis_delete on public.hotel_kpis
  for delete to authenticated using (public.is_admin());

create policy kpi_history_read on public.hotel_kpi_history
  for select to authenticated using (true);

-- Transactions : les lignes confidentielles sont invisibles sans habilitation.
create policy transactions_read on public.transactions
  for select to authenticated
  using (not confidentiel_client or public.has_confidential_access());
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (public.is_contributor() and (not confidentiel_client or public.has_confidential_access()));
create policy transactions_update on public.transactions
  for update to authenticated
  using (public.is_contributor() and (not confidentiel_client or public.has_confidential_access()))
  with check (public.is_contributor() and (not confidentiel_client or public.has_confidential_access()));
create policy transactions_delete on public.transactions
  for delete to authenticated using (public.is_admin());

-- Pipeline : lecture membres, écriture contributeur/admin.
create policy pipeline_read on public.pipeline_projects
  for select to authenticated using (true);
create policy pipeline_write on public.pipeline_projects
  for all to authenticated using (public.is_contributor()) with check (public.is_contributor());

-- Sélections : partagées, personnelles ou admin.
create policy selections_read on public.saved_selections
  for select to authenticated
  using (partage or auteur_id = auth.uid() or public.is_admin());
create policy selections_insert on public.saved_selections
  for insert to authenticated
  with check (public.is_contributor() and auteur_id = auth.uid());
create policy selections_update on public.saved_selections
  for update to authenticated
  using (auteur_id = auth.uid() or public.is_admin())
  with check (auteur_id = auth.uid() or public.is_admin());
create policy selections_delete on public.saved_selections
  for delete to authenticated using (auteur_id = auth.uid() or public.is_admin());

-- Benchmarks : visibilité confidentielle contrôlée.
create policy benchmarks_read on public.benchmarks
  for select to authenticated
  using (not confidentiel_client or public.has_confidential_access());
create policy benchmarks_write on public.benchmarks
  for all to authenticated
  using (public.is_contributor() and (not confidentiel_client or public.has_confidential_access()))
  with check (public.is_contributor() and (not confidentiel_client or public.has_confidential_access()));

-- Imports : lecture membres, création contributeur/admin.
create policy imports_read on public.import_batches
  for select to authenticated using (true);
create policy imports_insert on public.import_batches
  for insert to authenticated with check (public.is_contributor());

-- Tâches : lecture membres, mise à jour contributeur/admin.
create policy tasks_read on public.tasks
  for select to authenticated using (true);
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.is_contributor());
create policy tasks_update on public.tasks
  for update to authenticated using (public.is_contributor()) with check (public.is_contributor());
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_admin());

-- Audit : lecture filtrée, ajout par l'auteur, jamais de modification.
create policy audit_read on public.audit_log
  for select to authenticated
  using (not confidential or public.has_confidential_access());
create policy audit_insert on public.audit_log
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Privilèges (RLS reste la barrière principale)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- En production, exécuter ensuite :
--   supabase db push
-- puis créer les utilisateurs via Supabase Auth et vérifier leurs profils.
