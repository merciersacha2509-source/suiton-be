-- ===========================================================================
-- SUITON OS 1.0 — Sprint 2 — Creation atomique d'une reservation
-- ===========================================================================
-- Une reservation cree un client, un chantier, une ligne de score, un
-- evenement et un jeton de portail. Ces cinq ecritures doivent reussir ou
-- echouer ENSEMBLE.
--
-- Le client JavaScript de Supabase n'a pas de transaction : cinq appels
-- separes laisseraient, en cas d'echec du troisieme, un client sans chantier
-- et un chantier sans portail. D'ou cette fonction — c'est le seul endroit
-- du systeme ou la logique metier vit en SQL, et c'est justifie par
-- l'atomicite.
-- ===========================================================================

create or replace function public.create_booking(
  p_client       jsonb,   -- nom, email, telephone, kind, tva, commune, code_postal, adresse
  p_job          jsonb,   -- service, property_type, soil, surface_m2, commune, code_postal,
                          -- adresse, zone, urgent, date_souhaitee, source, notes
  p_estimation   jsonb,   -- min, max, duree_min, duree_max
  p_score        integer,
  p_score_detail jsonb,   -- { rule_code, points } appliques au socle
  p_token_hash   text,
  p_photo_ids    uuid[] default '{}'
)
returns table (
  job_id        uuid,
  job_reference text,
  client_id     uuid,
  token_id      uuid,
  est_nouveau   boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id   uuid;
  v_nouveau     boolean := false;
  v_job_id      uuid;
  v_reference   text;
  v_token_id    uuid;
  v_score_avant smallint;
  v_email       text := lower(btrim(p_client ->> 'email'));
begin
  if v_email is null or v_email = '' then
    raise exception 'Adresse e-mail manquante' using errcode = '22023';
  end if;

  -- --- Client : retrouve ou cree -------------------------------------------
  select id, score into v_client_id, v_score_avant
  from public.clients where lower(email) = v_email;

  if v_client_id is null then
    insert into public.clients (kind, nom, email, telephone, adresse, commune, code_postal, tva)
    values (
      coalesce((p_client ->> 'kind')::client_kind, 'particulier'),
      p_client ->> 'nom',
      v_email,
      p_client ->> 'telephone',
      p_client ->> 'adresse',
      p_client ->> 'commune',
      p_client ->> 'code_postal',
      nullif(p_client ->> 'tva', '')
    )
    returning id, score into v_client_id, v_score_avant;
    v_nouveau := true;
  else
    -- Client connu : on complete ce qui manque, on n'ecrase jamais. Le
    -- fichier client est plus fiable qu'un formulaire rempli a la hate.
    update public.clients set
      telephone   = coalesce(nullif(btrim(telephone), ''), p_client ->> 'telephone'),
      commune     = coalesce(commune, p_client ->> 'commune'),
      code_postal = coalesce(code_postal, p_client ->> 'code_postal'),
      adresse     = coalesce(adresse, p_client ->> 'adresse'),
      tva         = coalesce(tva, nullif(p_client ->> 'tva', ''))
    where id = v_client_id;
  end if;

  -- --- Chantier ------------------------------------------------------------
  insert into public.jobs (
    client_id, service, property_type, soil, surface_m2,
    adresse, commune, code_postal, zone, urgent, date_souhaitee,
    estimation_min, estimation_max, duree_estimee_min, source, notes
  ) values (
    v_client_id,
    (p_job ->> 'service')::service_type,
    coalesce((p_job ->> 'property_type')::property_type, 'autre'),
    coalesce((p_job ->> 'soil')::soil_level, 'standard'),
    (p_job ->> 'surface_m2')::integer,
    p_job ->> 'adresse',
    p_job ->> 'commune',
    p_job ->> 'code_postal',
    coalesce((p_job ->> 'zone')::zone_tier, 'principale'),
    coalesce((p_job ->> 'urgent')::boolean, false),
    nullif(p_job ->> 'date_souhaitee', '')::date,
    (p_estimation ->> 'min')::numeric,
    (p_estimation ->> 'max')::numeric,
    (p_estimation ->> 'duree_max')::integer,
    coalesce(p_job ->> 'source', 'site'),
    nullif(p_job ->> 'notes', '')
  )
  returning id, reference into v_job_id, v_reference;

  -- --- Photos deposees avant soumission ------------------------------------
  if array_length(p_photo_ids, 1) is not null then
    update public.photos set job_id = v_job_id
    where id = any(p_photo_ids) and job_id is null;
  end if;

  -- --- Score ---------------------------------------------------------------
  update public.clients set score = greatest(0, least(140, p_score)) where id = v_client_id;

  insert into public.score_events (client_id, job_id, rule_code, points, score_avant, score_apres, source)
  values (
    v_client_id, v_job_id, 'socle_initial',
    greatest(-128, least(127, p_score - coalesce(v_score_avant, 0))),
    coalesce(v_score_avant, 0), greatest(0, least(140, p_score)), 'reservation'
  );

  -- --- Journal -------------------------------------------------------------
  insert into public.events (job_id, client_id, type, payload)
  values (v_job_id, v_client_id, 'booking.created',
          jsonb_build_object('estimation', p_estimation, 'score', p_score,
                             'detail', p_score_detail, 'nouveau_client', v_nouveau));

  -- --- Jeton de portail ----------------------------------------------------
  insert into public.portal_tokens (job_id, token_hash)
  values (v_job_id, p_token_hash)
  returning id into v_token_id;

  return query select v_job_id, v_reference, v_client_id, v_token_id, v_nouveau;
end;
$$;

-- ===========================================================================
-- Disponibilites
-- ===========================================================================
-- Les creneaux proposes sont calcules par la base a partir des interventions
-- reelles. Les proposer depuis le navigateur laisserait deux visiteurs
-- reserver le meme creneau ; ici, la contrainte EXCLUDE tranche de toute
-- facon, mais autant ne pas proposer ce qui est deja pris.
-- ===========================================================================

create table public.business_hours (
  jour_semaine smallint primary key,   -- 0 = dimanche … 6 = samedi
  ouvert       boolean  not null default true,
  debut        time     not null default '08:00',
  fin          time     not null default '17:00',

  constraint business_hours_jour  check (jour_semaine between 0 and 6),
  constraint business_hours_ordre check (fin > debut)
);

insert into public.business_hours (jour_semaine, ouvert, debut, fin) values
  (0, false, '08:00', '17:00'),
  (1, true,  '08:00', '17:00'),
  (2, true,  '08:00', '17:00'),
  (3, true,  '08:00', '17:00'),
  (4, true,  '08:00', '17:00'),
  (5, true,  '08:00', '17:00'),
  (6, true,  '08:00', '13:00')
on conflict (jour_semaine) do nothing;

create table public.blackout_dates (
  jour   date primary key,
  motif  text not null
);

alter table public.business_hours  enable row level security;
alter table public.blackout_dates  enable row level security;

create policy business_hours_read on public.business_hours for select using (true);
create policy business_hours_admin on public.business_hours
  for all using (public.is_admin()) with check (public.is_admin());
create policy blackout_read on public.blackout_dates for select using (true);
create policy blackout_admin on public.blackout_dates
  for all using (public.is_admin()) with check (public.is_admin());

/**
 * Creneaux libres pour une equipe, sur une plage de jours.
 *
 * Un creneau est libre si aucune intervention non annulee ne le chevauche,
 * tampon de trajet compris — exactement le meme critere que la contrainte
 * EXCLUDE, pour que l'interface ne propose jamais ce que la base refusera.
 */
create or replace function public.free_slots(
  p_team_id     uuid,
  p_depuis      date,
  p_jusqu_au    date,
  p_duree_min   integer,
  p_tampon_min  integer default 30
)
returns table (debut timestamptz, fin timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with jours as (
    select d::date as jour
    from generate_series(p_depuis, p_jusqu_au, interval '1 day') d
    where not exists (select 1 from public.blackout_dates b where b.jour = d::date)
  ),
  plages as (
    select
      (j.jour + h.debut) at time zone 'Europe/Brussels' as ouverture,
      (j.jour + h.fin)   at time zone 'Europe/Brussels' as fermeture
    from jours j
    join public.business_hours h on h.jour_semaine = extract(dow from j.jour)::smallint
    where h.ouvert
  ),
  candidats as (
    select
      p.ouverture + make_interval(mins => (n * 60)) as debut,
      p.ouverture + make_interval(mins => (n * 60) + p_duree_min) as fin
    from plages p
    cross join generate_series(0, 12) n
    where p.ouverture + make_interval(mins => (n * 60) + p_duree_min) <= p.fermeture
  )
  select c.debut, c.fin
  from candidats c
  where c.debut > now() + interval '24 hours'          -- pas de reservation le jour meme
    and not exists (
      select 1 from public.interventions i
      where i.team_id = p_team_id
        and i.status <> 'annule'
        and tstzrange(i.starts_at, i.ends_at_buffered, '[)')
            && tstzrange(c.debut, c.fin + make_interval(mins => p_tampon_min), '[)')
    )
  order by c.debut;
$$;
