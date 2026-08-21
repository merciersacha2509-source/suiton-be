-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Evenements, score, automatisations, audit,
--                            reglages
-- ===========================================================================

create table public.events (
  id          bigserial primary key,
  job_id      uuid references public.jobs (id)    on delete cascade,
  client_id   uuid references public.clients (id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  actor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index events_job_idx  on public.events (job_id, created_at desc);
create index events_type_idx on public.events (type, created_at desc);

-- ---------------------------------------------------------------------------
-- score_events : l'historique n'est jamais ecrase. On doit pouvoir repondre
-- a « pourquoi ce client est-il passe de 95 a 80 ? » six mois plus tard.
-- ---------------------------------------------------------------------------
create table public.score_events (
  id          bigserial primary key,
  client_id   uuid not null references public.clients (id) on delete cascade,
  job_id      uuid references public.jobs (id) on delete set null,
  rule_code   text     not null,
  points      smallint not null,
  score_avant smallint not null,
  score_apres smallint not null,
  source      text     not null default 'systeme',
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),

  constraint score_events_bornes check (
    score_avant between 0 and 140 and score_apres between 0 and 140
  )
);

create index score_events_client_idx on public.score_events (client_id, created_at desc);
-- Pas de predicat `where expires_at > now()` : now() est STABLE, pas
-- IMMUTABLE, et Postgres refuse un index dont le predicat pourrait changer
-- de verite sans que la ligne bouge. Le filtre temporel se fait a la
-- requete, l'index couvre la colonne.
create index score_events_actifs_idx on public.score_events (client_id, expires_at);

-- ---------------------------------------------------------------------------
-- automations : etat des scenarios Make. Un scenario qui echoue cinq fois de
-- suite est desactive — mieux vaut une panne visible qu'une panne silencieuse
-- qui envoie n'importe quoi aux clients.
-- ---------------------------------------------------------------------------
create table public.automations (
  code                text primary key,
  libelle             text not null,
  state               automation_state not null default 'actif',
  webhook_url         text,
  derniere_execution  timestamptz,
  dernier_succes      timestamptz,
  echecs_consecutifs  smallint not null default 0,
  executions_total    integer  not null default 0,
  updated_at          timestamptz not null default now(),

  constraint automations_echecs_positifs check (echecs_consecutifs >= 0)
);

create trigger automations_touch before update on public.automations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs : journal d'audit ET table d'idempotence.
--
-- L'index unique partiel sur idempotency_key en succes fait qu'un rejeu de
-- webhook produit une violation d'unicite, interceptee par l'application,
-- qui repond 200 sans effet.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id              bigserial primary key,
  actor_id        uuid references public.profiles (id) on delete set null,
  actor_label     text,
  action          text not null,
  table_name      text,
  record_id       uuid,
  avant           jsonb,
  apres           jsonb,
  idempotency_key text,
  status          text not null default 'ok',
  ip              inet,
  created_at      timestamptz not null default now(),

  constraint audit_logs_status_connu check (status in ('ok', 'erreur'))
);

create unique index audit_logs_idempotence
  on public.audit_logs (idempotency_key)
  where idempotency_key is not null and status = 'ok';

create index audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_date_idx   on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- settings : une seule ligne active. La grille tarifaire y vit — elle n'est
-- ecrite en dur nulle part dans le code.
-- ---------------------------------------------------------------------------
create table public.settings (
  id                    boolean primary key default true,

  prix_m2               jsonb not null,
  zones                 jsonb not null,
  majoration_urgence    numeric(4,3) not null default 0.200,
  seuil_surface_devis   integer not null default 300,
  tva_taux              numeric(4,3) not null default 0.210,

  delai_devis_heures    smallint not null default 24,
  garantie_heures       smallint not null default 48,
  tampon_trajet_min     smallint not null default 30,

  entreprise            jsonb not null,

  updated_by            uuid references public.profiles (id) on delete set null,
  updated_at            timestamptz not null default now(),

  constraint settings_ligne_unique check (id),
  constraint settings_majoration check (majoration_urgence between 0 and 1),
  constraint settings_tva check (tva_taux between 0 and 0.30)
);

create table public.settings_history (
  id          bigserial primary key,
  avant       jsonb not null,
  apres       jsonb not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- L'historique est ecrit par la base, jamais par l'application : une route
-- qui oublierait de le faire rendrait le journal incomplet sans que
-- personne ne s'en apercoive.
create or replace function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.settings_history (avant, apres, updated_by)
  values (to_jsonb(old), to_jsonb(new), new.updated_by);
  return new;
end;
$$;

create trigger settings_history_trg after update on public.settings
  for each row execute function public.log_settings_change();

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
