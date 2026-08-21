-- ===========================================================================
-- SUITON OS 1.0 — Sprint 5 — Moteur de donnees
-- ===========================================================================
-- Un chantier n'est plus un dossier, c'est une donnee.
--
-- `job_metrics` est une ligne PAR CHANTIER, remplie automatiquement au fil du
-- cycle de vie. Volontairement denormalisee : les statistiques se lisent des
-- centaines de fois pour une ecriture, et une moyenne qui exige six jointures
-- ne se calcule jamais assez vite pour un tableau de bord.
-- ===========================================================================

create table public.job_metrics (
  job_id            uuid primary key references public.jobs (id) on delete cascade,
  reference         text not null,

  -- --- Dimensions (ce sur quoi on segmente) -------------------------------
  service           service_type  not null,
  property_type     property_type not null,
  soil              soil_level    not null,
  surface_m2        integer       not null,
  commune           text          not null,
  zone              zone_tier     not null,
  client_kind       client_kind   not null,
  team_id           uuid references public.teams (id) on delete set null,
  source            text,

  -- --- Commercial ---------------------------------------------------------
  devis_htva        numeric(10,2),
  devis_ttc         numeric(10,2),
  facture_htva      numeric(10,2),
  facture_ttc       numeric(10,2),
  -- Ecart entre devise et facture. Systematiquement negatif = grille trop basse.
  ecart_facturation numeric(10,2),
  delai_signature_h integer,
  delai_paiement_j  integer,

  -- --- Operationnel -------------------------------------------------------
  duree_estimee_min integer,
  duree_estimee_max integer,
  duree_reelle_min  integer,
  techniciens       smallint not null default 1,
  -- Minutes par m² : l'indicateur le plus comparable d'un chantier a l'autre.
  minutes_par_m2    numeric(6,2),
  temps_par_etape   jsonb not null default '{}'::jsonb,
  materiel          text[] not null default '{}',

  -- --- Qualite ------------------------------------------------------------
  photos_total       smallint not null default 0,
  paires_completes   smallint not null default 0,
  paires_incompletes smallint not null default 0,
  couverture_photo   numeric(5,2),
  checklist_complete boolean not null default false,
  -- Etapes cochees a la meme minute : checklist remplie apres coup, donc
  -- sans valeur de preuve.
  checklist_suspecte boolean not null default false,
  retouches          smallint not null default 0,
  incidents          smallint not null default 0,
  observations_len   integer  not null default 0,

  -- --- Client -------------------------------------------------------------
  avis_note         smallint,
  avis_depose       boolean not null default false,
  recommandations   smallint not null default 0,
  chantier_rang     smallint not null default 1,

  -- --- Cycle de vie -------------------------------------------------------
  demande_le        timestamptz,
  devis_envoye_le   timestamptz,
  devis_accepte_le  timestamptz,
  realise_le        timestamptz,
  facture_le        timestamptz,
  paye_le           timestamptz,

  -- Termine ET facture. Seules ces lignes entrent dans les references.
  complet           boolean not null default false,

  updated_at        timestamptz not null default now(),

  constraint metrics_surface check (surface_m2 between 1 and 5000),
  constraint metrics_couverture check (couverture_photo is null or couverture_photo between 0 and 100),
  constraint metrics_avis check (avis_note is null or avis_note between 1 and 5),
  constraint metrics_techniciens check (techniciens between 1 and 20)
);

create index metrics_dimensions_idx on public.job_metrics (service, property_type, soil);
create index metrics_surface_idx    on public.job_metrics (surface_m2);
create index metrics_commune_idx    on public.job_metrics (commune);
create index metrics_team_idx       on public.job_metrics (team_id);
create index metrics_complets_idx   on public.job_metrics (realise_le desc) where complet;

create trigger metrics_touch before update on public.job_metrics
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Bandes de surface
--
-- Comparer un studio de 40 m² a une villa de 400 m² n'a pas de sens : la
-- cadence au m² n'est pas lineaire, les petites surfaces portant un cout
-- fixe d'installation proportionnellement plus lourd.
-- ---------------------------------------------------------------------------
create or replace function public.bande_surface(p_surface integer)
returns text
language sql
immutable
as $$
  select case
    when p_surface <  60 then 'xs'
    when p_surface < 110 then 's'
    when p_surface < 180 then 'm'
    when p_surface < 300 then 'l'
    else                      'xl'
  end
$$;

-- ---------------------------------------------------------------------------
-- Extraction automatique
--
-- Recalcule INTEGRALEMENT la ligne de metriques a partir des tables metier.
-- Idempotente : rejouable a volonte. Appelee a chaque etape du cycle, ce qui
-- evite des compteurs incrementaux qui finissent toujours par deriver.
-- ---------------------------------------------------------------------------
create or replace function public.rafraichir_metriques(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job        record;
  v_devis      record;
  v_facture    record;
  v_rapport    record;
  v_inter      record;
  v_photos     record;
  v_note       smallint;
  v_etapes     jsonb := '{}'::jsonb;
  v_minutes_m2 numeric;
  v_couverture numeric;
  v_rang       smallint;
  v_suspecte   boolean := false;
  v_complete   boolean := false;
  v_demande    timestamptz;
  v_distinctes integer;
begin
  select j.*, c.kind as ckind into v_job
  from public.jobs j join public.clients c on c.id = j.client_id
  where j.id = p_job_id;

  if not found then return; end if;

  select * into v_devis from public.quotes
  where job_id = p_job_id order by created_at desc limit 1;

  select * into v_facture from public.invoices
  where job_id = p_job_id and kind = 'facture' order by created_at desc limit 1;

  select * into v_rapport from public.reports
  where job_id = p_job_id order by created_at desc limit 1;

  select * into v_inter from public.interventions
  where job_id = p_job_id and status = 'termine' order by starts_at limit 1;

  -- --- Temps par etape ----------------------------------------------------
  if v_inter.id is not null then
    select jsonb_object_agg(ordre::text, minutes) into v_etapes
    from (
      select cp.ordre,
             coalesce(
               extract(epoch from (cp.fait_at - lag(cp.fait_at) over (order by cp.ordre))) / 60,
               0
             )::integer as minutes
      from public.checklist_progress cp
      where cp.intervention_id = v_inter.id
    ) t;

    select count(*) = 6 into v_complete
    from public.checklist_progress where intervention_id = v_inter.id;

    -- Toutes les etapes dans la meme minute : cochees apres coup.
    select count(distinct date_trunc('minute', fait_at)) into v_distinctes
    from public.checklist_progress where intervention_id = v_inter.id;
    v_suspecte := coalesce(v_complete, false) and coalesce(v_distinctes, 0) <= 2;
  end if;

  -- --- Photos -------------------------------------------------------------
  select
    count(*) filter (where phase in ('avant','apres'))            as total,
    count(*) filter (where paire is not null and phase = 'avant') as avants,
    count(*) filter (where paire is not null and phase = 'apres') as apres
  into v_photos
  from public.photos where job_id = p_job_id;

  select note into v_note from public.reviews
  where job_id = p_job_id order by created_at desc limit 1;

  select count(*)::smallint into v_rang from public.jobs
  where client_id = v_job.client_id and created_at <= v_job.created_at;

  if v_job.duree_reelle_min is not null and v_job.surface_m2 > 0 then
    v_minutes_m2 := round(v_job.duree_reelle_min::numeric / v_job.surface_m2, 2);
  end if;

  if coalesce(v_photos.avants, 0) > 0 then
    v_couverture := round(least(v_photos.apres, v_photos.avants)::numeric * 100 / v_photos.avants, 2);
  end if;

  select min(created_at) into v_demande from public.events
  where job_id = p_job_id and type = 'booking.created';

  insert into public.job_metrics as m (
    job_id, reference, service, property_type, soil, surface_m2, commune, zone,
    client_kind, team_id, source,
    devis_htva, devis_ttc, facture_htva, facture_ttc, ecart_facturation,
    delai_signature_h, delai_paiement_j,
    duree_estimee_min, duree_estimee_max, duree_reelle_min, minutes_par_m2, temps_par_etape,
    photos_total, paires_completes, paires_incompletes, couverture_photo,
    checklist_complete, checklist_suspecte, observations_len,
    avis_note, avis_depose, chantier_rang,
    demande_le, devis_envoye_le, devis_accepte_le, realise_le, facture_le, paye_le, complet
  ) values (
    p_job_id, v_job.reference, v_job.service, v_job.property_type, v_job.soil,
    v_job.surface_m2, v_job.commune, v_job.zone, v_job.ckind, v_inter.team_id, v_job.source,
    v_devis.montant_htva, v_devis.montant_ttc, v_facture.montant_htva, v_facture.montant_ttc,
    case when v_devis.montant_htva is not null and v_facture.montant_htva is not null
         then v_facture.montant_htva - v_devis.montant_htva end,
    case when v_devis.sent_at is not null and v_devis.accepted_at is not null
         then ceil(extract(epoch from (v_devis.accepted_at - v_devis.sent_at)) / 3600)::integer end,
    case when v_facture.date_emission is not null and v_facture.paid_at is not null
         then (v_facture.paid_at::date - v_facture.date_emission) end,
    v_job.duree_estimee_min, v_job.duree_estimee_min, v_job.duree_reelle_min, v_minutes_m2,
    coalesce(v_etapes, '{}'::jsonb),
    coalesce(v_photos.total, 0)::smallint,
    least(coalesce(v_photos.avants, 0), coalesce(v_photos.apres, 0))::smallint,
    abs(coalesce(v_photos.avants, 0) - coalesce(v_photos.apres, 0))::smallint,
    v_couverture, coalesce(v_complete, false), coalesce(v_suspecte, false),
    coalesce(length(v_rapport.observations), 0),
    v_note, v_note is not null, coalesce(v_rang, 1),
    v_demande, v_devis.sent_at, v_devis.accepted_at,
    v_inter.termine_at, v_facture.date_emission, v_facture.paid_at,
    v_job.stage = 'termine' and v_facture.id is not null
  )
  on conflict (job_id) do update set
    reference = excluded.reference, service = excluded.service,
    property_type = excluded.property_type, soil = excluded.soil,
    surface_m2 = excluded.surface_m2, commune = excluded.commune, zone = excluded.zone,
    client_kind = excluded.client_kind, team_id = excluded.team_id, source = excluded.source,
    devis_htva = excluded.devis_htva, devis_ttc = excluded.devis_ttc,
    facture_htva = excluded.facture_htva, facture_ttc = excluded.facture_ttc,
    ecart_facturation = excluded.ecart_facturation,
    delai_signature_h = excluded.delai_signature_h, delai_paiement_j = excluded.delai_paiement_j,
    duree_estimee_min = excluded.duree_estimee_min, duree_estimee_max = excluded.duree_estimee_max,
    duree_reelle_min = excluded.duree_reelle_min, minutes_par_m2 = excluded.minutes_par_m2,
    temps_par_etape = excluded.temps_par_etape, photos_total = excluded.photos_total,
    paires_completes = excluded.paires_completes, paires_incompletes = excluded.paires_incompletes,
    couverture_photo = excluded.couverture_photo, checklist_complete = excluded.checklist_complete,
    checklist_suspecte = excluded.checklist_suspecte, observations_len = excluded.observations_len,
    avis_note = excluded.avis_note, avis_depose = excluded.avis_depose,
    chantier_rang = excluded.chantier_rang, demande_le = excluded.demande_le,
    devis_envoye_le = excluded.devis_envoye_le, devis_accepte_le = excluded.devis_accepte_le,
    realise_le = excluded.realise_le, facture_le = excluded.facture_le,
    paye_le = excluded.paye_le, complet = excluded.complet;
end;
$$;

alter table public.job_metrics enable row level security;
create policy metrics_staff on public.job_metrics for select using (public.is_staff());
