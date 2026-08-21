-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Devis et factures
-- ===========================================================================

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  numero        text        not null,
  job_id        uuid        not null references public.jobs (id) on delete cascade,

  status        quote_status not null default 'brouillon',
  vat_regime    vat_regime   not null default 'standard_21',

  montant_htva  numeric(10,2) not null,
  tva_montant   numeric(10,2) not null default 0,
  montant_ttc   numeric(10,2) not null,

  lignes        jsonb        not null default '[]'::jsonb,

  valide_jusqu_au date       not null default (current_date + 30),
  sent_at       timestamptz,
  accepted_at   timestamptz,
  refused_at    timestamptz,
  open_count    integer      not null default 0,
  last_opened_at timestamptz,

  pdf_path      text,
  created_by    uuid         references public.profiles (id) on delete set null,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint quotes_numero_unique unique (numero),
  constraint quotes_montants_positifs check (montant_htva >= 0 and montant_ttc >= 0),
  -- Coherence arithmetique verifiee par la base : une TVA fausse sur un devis
  -- se retrouve sur la facture, et de la dans la declaration.
  constraint quotes_ttc_coherent check (
    abs(montant_ttc - (montant_htva + tva_montant)) < 0.01
  ),
  constraint quotes_autoliquidation_sans_tva check (
    vat_regime <> 'autoliquidation' or tva_montant = 0
  ),
  constraint quotes_envoye_a_une_date check (status = 'brouillon' or sent_at is not null),
  constraint quotes_accepte_a_une_date check (status <> 'accepte' or accepted_at is not null)
);

create index quotes_job_idx    on public.quotes (job_id);
create index quotes_status_idx on public.quotes (status);
create index quotes_relance_idx on public.quotes (sent_at)
  where status = 'envoye';

create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

create or replace function public.set_quote_numero()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_annee smallint := extract(year from now())::smallint;
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := format('SUITON-D-%s-%s', v_annee,
                         lpad(public.next_number('quote', v_annee)::text, 4, '0'));
  end if;
  return new;
end;
$$;

create trigger quotes_numero before insert on public.quotes
  for each row execute function public.set_quote_numero();

-- ---------------------------------------------------------------------------
-- invoices
--
-- La contrainte b2b_peppol est le point le plus important de ce fichier.
-- Depuis le 1er janvier 2026, une facture B2B belge doit etre transmise en
-- format structure via Peppol. Un PDF n'y satisfait pas et empeche le client
-- de deduire sa TVA — il s'en apercevra a sa declaration, plusieurs semaines
-- plus tard, et le litige portera sur un montant qu'il vous reclamera.
-- La regle est donc posee dans la base, pas dans le code : une erreur
-- applicative ne doit pas pouvoir produire une facture non conforme.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  numero        text        not null,
  kind          invoice_kind not null default 'facture',
  job_id        uuid        not null references public.jobs (id)     on delete restrict,
  client_id     uuid        not null references public.clients (id)  on delete restrict,
  partner_id    uuid        references public.partners (id)          on delete restrict,
  avoir_de      uuid        references public.invoices (id)          on delete restrict,

  status        invoice_status not null default 'brouillon',
  vat_regime    vat_regime     not null default 'standard_21',

  montant_htva  numeric(10,2) not null,
  tva_montant   numeric(10,2) not null default 0,
  montant_ttc   numeric(10,2) not null,

  peppol_id     text,
  billit_id     text,
  billit_status text,

  date_emission date,
  date_echeance date,
  paid_at       timestamptz,

  pdf_path      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint invoices_numero_unique unique (numero),
  constraint invoices_ttc_coherent check (
    abs(montant_ttc - (montant_htva + tva_montant)) < 0.01
  ),
  constraint invoices_autoliquidation_sans_tva check (
    vat_regime <> 'autoliquidation' or tva_montant = 0
  ),
  constraint invoices_avoir_negatif check (
    kind = 'facture' or montant_htva <= 0
  ),
  constraint invoices_avoir_a_une_source check (kind = 'facture' or avoir_de is not null),
  constraint invoices_emise_a_une_date check (status = 'brouillon' or date_emission is not null),

  -- CONTRAINTE PEPPOL — voir commentaire ci-dessus.
  constraint b2b_peppol check (
    status = 'brouillon'
    or partner_id is null
    or (peppol_id is not null and length(btrim(peppol_id)) > 0)
  )
);

create index invoices_job_idx     on public.invoices (job_id);
create index invoices_client_idx  on public.invoices (client_id);
create index invoices_status_idx  on public.invoices (status);
create index invoices_impayees_idx on public.invoices (date_echeance)
  where status = 'emise';

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create or replace function public.set_invoice_numero()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_annee smallint := extract(year from now())::smallint;
  v_scope text     := case when new.kind = 'avoir' then 'credit' else 'invoice' end;
  v_pref  text     := case when new.kind = 'avoir' then 'SUITON-A' else 'SUITON-F' end;
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := format('%s-%s-%s', v_pref, v_annee,
                         lpad(public.next_number(v_scope, v_annee)::text, 4, '0'));
  end if;
  return new;
end;
$$;

create trigger invoices_numero before insert on public.invoices
  for each row execute function public.set_invoice_numero();
