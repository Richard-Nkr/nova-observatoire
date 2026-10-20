-- -----------------------------------------------------------------------------
-- Adaptation au schéma « 7 bases » de l'observatoire
-- Hôtel · Identité · Exploitation · Transaction · Prix/nuit · MICE · Valorisations
-- Migration additive : ne détruit aucune donnée existante.
-- -----------------------------------------------------------------------------

-- 1. Transaction : champs compilés depuis CFNEWS, prix/acheteur/vendeur facultatifs.
alter table public.transactions
  alter column type drop not null,
  add column if not exists exercice_ca_avant text,
  add column if not exists exercice_ca_apres text,
  add column if not exists gamme_avant text,
  add column if not exists gamme_apres text,
  add column if not exists cles_avant integer,
  add column if not exists cles_apres integer,
  add column if not exists analyste text,
  add column if not exists localisation text,
  add column if not exists source_avant jsonb,
  add column if not exists source_apres jsonb;

comment on column public.transactions.prix is
  'Prix de cession — null lorsque non documenté (ne jamais saisir 0 par défaut).';
comment on column public.transactions.type is
  'Nature du deal — null lorsque non documentée.';

-- 2. BDD Identité (Atout France + missions) : une observation par actif et par date.
create table if not exists public.identities (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  date_observation date not null,
  nom text not null,
  marque text,
  chambres integer check (chambres is null or chambres >= 0),
  suites integer check (suites is null or suites >= 0),
  surface_totale numeric,
  surface_hebergement numeric,
  equipements_hors_restauration jsonb not null default '{}'::jsonb,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists identities_hotel_idx on public.identities (hotel_id);
create index if not exists identities_date_idx on public.identities (date_observation);

-- 3. BDD Exploitation (missions) : une ligne par exercice renseigné.
create table if not exists public.exploitations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  annee integer,
  annee_label text not null,
  ca numeric,
  ebitda numeric,
  ebitda_pct numeric,
  phase text not null default 'Courant'
    check (phase in ('Avant cession', 'Après cession', 'Courant')),
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exploitation_n3_hypothese check (
    source_fiabilite <> 'N3' or source_hypothese is not null
  )
);

create unique index if not exists exploitations_hotel_phase_year_key
  on public.exploitations (hotel_id, phase, annee)
  where annee is not null;
create index if not exists exploitations_hotel_idx on public.exploitations (hotel_id);
create index if not exists exploitations_annee_idx on public.exploitations (annee);

-- 4. BDD Prix / nuit (missions) : une ligne par prix observé.
create table if not exists public.price_observations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  date_observation date not null,
  prix numeric not null check (prix >= 0),
  chambre text,
  occupation numeric check (occupation is null or (occupation >= 0 and occupation <= 1)),
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now()
);

create index if not exists price_observations_hotel_idx on public.price_observations (hotel_id);
create index if not exists price_observations_date_idx on public.price_observations (date_observation);

-- 5. BDD MICE (missions) : une ligne par exercice renseigné.
create table if not exists public.mice_observations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  annee integer,
  annee_label text not null,
  nb_salles integer check (nb_salles is null or nb_salles >= 0),
  surface_totale numeric,
  surface_plus_grande_salle numeric,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mice_observations_hotel_idx on public.mice_observations (hotel_id);

-- 6. BDD Valorisations NOVA (missions).
create table if not exists public.valuations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  annee integer,
  annee_label text not null,
  valorisation numeric,
  methode text,
  source_source text not null,
  source_date date not null,
  source_auteur text not null,
  source_fiabilite public.reliability_level not null,
  source_hypothese text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valuation_n3_hypothese check (
    source_fiabilite <> 'N3' or source_hypothese is not null
  )
);

create index if not exists valuations_hotel_idx on public.valuations (hotel_id);

-- 7. Triggers updated_at et RLS alignée sur l'observatoire.
do $$
declare
  t text;
begin
  foreach t in array array['identities', 'exploitations', 'mice_observations', 'valuations']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table public.price_observations enable row level security;

create policy identities_read on public.identities for select to authenticated using (true);
create policy identities_write on public.identities for all to authenticated
  using (public.is_contributor() or public.is_admin())
  with check (public.is_contributor() or public.is_admin());

create policy exploitations_read on public.exploitations for select to authenticated using (true);
create policy exploitations_write on public.exploitations for all to authenticated
  using (public.is_contributor() or public.is_admin())
  with check (public.is_contributor() or public.is_admin());

create policy price_observations_read on public.price_observations for select to authenticated using (true);
create policy price_observations_write on public.price_observations for all to authenticated
  using (public.is_contributor() or public.is_admin())
  with check (public.is_contributor() or public.is_admin());

create policy mice_observations_read on public.mice_observations for select to authenticated using (true);
create policy mice_observations_write on public.mice_observations for all to authenticated
  using (public.is_contributor() or public.is_admin())
  with check (public.is_contributor() or public.is_admin());

create policy valuations_read on public.valuations for select to authenticated using (true);
create policy valuations_write on public.valuations for all to authenticated
  using (public.is_contributor() or public.is_admin())
  with check (public.is_contributor() or public.is_admin());

-- 8. Note de déploiement :
--    supabase db push
--    Les tables Prix/nuit, MICE et Valorisations restent vides tant que les
--    connecteurs MISSIONS ne sont pas branchés. Aucune valeur n'est extrapolée.
