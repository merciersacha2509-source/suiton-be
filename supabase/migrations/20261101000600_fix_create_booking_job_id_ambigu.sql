-- ===========================================================================
-- Correctif : create_booking echouait des qu'une photo etait jointe
-- ===========================================================================
-- `returns table (job_id uuid, ...)` declare implicitement une variable
-- PL/pgSQL nommee `job_id`. Le bloc qui rattache les photos deposees avant
-- soumission au chantier ("update public.photos set job_id = v_job_id where
-- id = any(p_photo_ids) and job_id is null") reference alors une colonne
-- `job_id` ambigue entre celle de la table `photos` et cette variable de
-- sortie — Postgres refuse la requete avec "column reference job_id is
-- ambiguous".
--
-- Le chemin n'etait jamais teste avec une vraie photo jointe : le bug est
-- reste invisible jusqu'a un essai de bout en bout. Correctif : alias de
-- table explicite sur `photos`, qui leve l'ambiguite.
-- ===========================================================================

create or replace function public.create_booking(
  p_client       jsonb,
  p_job          jsonb,
  p_estimation   jsonb,
  p_score        integer,
  p_score_detail jsonb,
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
  -- Alias `p` explicite : leve l'ambiguite avec la variable de sortie job_id.
  if array_length(p_photo_ids, 1) is not null then
    update public.photos p set job_id = v_job_id
    where p.id = any(p_photo_ids) and p.job_id is null;
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
