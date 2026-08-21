-- ===========================================================================
-- SUITON OS 1.0 — Sprint 3 — Terrain
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Progression de checklist, etape par etape.
--
-- Une colonne jsonb sur `reports` ne suffirait pas : on veut savoir QUAND
-- chaque etape a ete cochee. Un chantier de six heures dont les six etapes
-- sont validees a la meme minute n'a pas ete fait dans l'ordre — et cet
-- horodatage est ce qui rend la checklist opposable en cas de litige.
-- --------------------------------------------------------------------------
create table public.checklist_progress (
  intervention_id uuid     not null references public.interventions (id) on delete cascade,
  ordre           smallint not null references public.checklist_steps (ordre),
  fait_at         timestamptz not null default now(),
  fait_par        uuid references public.profiles (id) on delete set null,
  note            text,

  primary key (intervention_id, ordre)
);

create index checklist_progress_inter_idx on public.checklist_progress (intervention_id);

-- --------------------------------------------------------------------------
-- Photos : appariement avant/apres
--
-- Une paire relie une photo « avant » a une photo « apres » de la MEME piece.
-- Sans contrainte, on se retrouve avec deux « avant » dans la meme paire, et
-- le rapport affiche deux fois la meme chose cote a cote.
-- --------------------------------------------------------------------------
create unique index photos_paire_unique
  on public.photos (job_id, paire, phase)
  where paire is not null and phase in ('avant', 'apres');

-- --------------------------------------------------------------------------
-- Le rapport ne peut exister que si l'intervention est terminee.
-- --------------------------------------------------------------------------
create or replace function public.verifier_rapport()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statut intervention_status;
  v_etapes integer;
begin
  if new.intervention_id is null then
    return new;
  end if;

  select status into v_statut from public.interventions where id = new.intervention_id;

  if v_statut is null then
    raise exception 'Intervention introuvable' using errcode = '23503';
  end if;

  if v_statut not in ('sur_place', 'termine') then
    raise exception 'Un rapport ne peut etre valide que depuis le chantier (statut actuel : %)', v_statut
      using errcode = '23514';
  end if;

  select count(*) into v_etapes
  from public.checklist_progress where intervention_id = new.intervention_id;

  if v_etapes < 6 then
    raise exception 'La checklist est incomplete : % etape(s) sur 6', v_etapes
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger reports_verification
  before insert on public.reports
  for each row execute function public.verifier_rapport();

-- --------------------------------------------------------------------------
-- Cloture d'intervention : renseigne la duree reelle et fait avancer le
-- chantier. En base plutot que dans l'application, pour que ce soit vrai
-- quel que soit le chemin emprunte.
-- --------------------------------------------------------------------------
create or replace function public.cloturer_intervention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minutes integer;
begin
  if new.status = 'termine' and old.status <> 'termine' then
    new.termine_at := coalesce(new.termine_at, now());

    if new.sur_place_at is not null then
      v_minutes := ceil(extract(epoch from (new.termine_at - new.sur_place_at)) / 60)::integer;

      update public.jobs
      set duree_reelle_min = v_minutes, stage = 'termine'
      where id = new.job_id and stage <> 'termine';
    else
      update public.jobs set stage = 'termine' where id = new.job_id and stage <> 'termine';
    end if;
  end if;

  return new;
end;
$$;

create trigger interventions_cloture
  before update on public.interventions
  for each row execute function public.cloturer_intervention();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table public.checklist_progress enable row level security;

create policy checklist_progress_staff on public.checklist_progress
  for all using (public.is_staff()) with check (public.is_staff());

create policy checklist_progress_technicien on public.checklist_progress
  for all using (
    exists (
      select 1 from public.interventions i
      where i.id = checklist_progress.intervention_id
        and i.team_id in (select public.my_team_ids())
    )
  ) with check (
    exists (
      select 1 from public.interventions i
      where i.id = checklist_progress.intervention_id
        and i.team_id in (select public.my_team_ids())
    )
  );

-- --------------------------------------------------------------------------
-- Vue terrain : ce que le technicien voit, SANS AUCUN MONTANT.
--
-- security_invoker : la vue applique les politiques RLS de l'appelant, elle
-- ne les contourne pas. Une vue sans cette option s'executerait avec les
-- droits de son proprietaire et donnerait acces a tout.
-- --------------------------------------------------------------------------
create or replace view public.vue_terrain
with (security_invoker = true) as
select
  i.id                as intervention_id,
  i.status,
  i.starts_at,
  i.ends_at,
  i.en_route_at,
  i.sur_place_at,
  i.acces_notes,
  j.id                as job_id,
  j.reference,
  j.service,
  j.property_type,
  j.soil,
  j.surface_m2,
  j.adresse,
  j.commune,
  j.code_postal,
  j.notes,
  c.nom               as client_nom,
  c.telephone         as client_telephone,
  t.nom               as equipe_nom,
  i.team_id
from public.interventions i
join public.jobs j    on j.id = i.job_id
join public.clients c on c.id = j.client_id
join public.teams t   on t.id = i.team_id
where i.status <> 'annule';

comment on view public.vue_terrain is
  'Vue terrain. Ne contient AUCUN montant : le telephone d''un technicien peut etre perdu ou vole.';
