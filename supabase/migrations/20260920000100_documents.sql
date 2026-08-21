-- ===========================================================================
-- SUITON OS 1.0 — Sprint 3 — Documents commerciaux
-- ===========================================================================
-- Les gabarits SUITON existants font foi. Ce fichier ajoute ce qu'ils
-- exigent et qui manquait : coordonnees bancaires, acompte, conditions,
-- communication structuree.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Reglages : bloc bancaire et conditions commerciales
-- --------------------------------------------------------------------------
alter table public.settings
  add column if not exists banque jsonb not null default jsonb_build_object(
    'iban', '', 'bic', '', 'titulaire', 'SUITON — Sacha Mercier'
  ),
  add column if not exists acompte_pct numeric(5,2) not null default 30,
  add column if not exists delai_paiement_jours smallint not null default 15,
  add column if not exists validite_devis_jours smallint not null default 30;

alter table public.settings
  add constraint settings_acompte check (acompte_pct between 0 and 100),
  add constraint settings_delai_paiement check (delai_paiement_jours between 0 and 90);

-- --------------------------------------------------------------------------
-- Communication structuree belge
--
-- Format +++123/4567/89012+++ : 10 chiffres libres suivis d'une cle de
-- controle sur 2 chiffres, egale au reste de la division par 97 — et 97
-- lorsque ce reste vaut 0, car « 00 » n'est pas une cle valide.
--
-- Sans elle, un virement client arrive sans reference et le rapprochement
-- se fait a la main, facture par facture.
-- --------------------------------------------------------------------------
create or replace function public.communication_structuree(p_numero integer, p_annee smallint)
returns text
language plpgsql
immutable
as $$
declare
  v_base   bigint;
  v_cle    integer;
  v_douze  text;
begin
  -- 10 chiffres : annee sur 4 + numero sur 6.
  v_base := (p_annee::bigint * 1000000) + least(p_numero, 999999);
  v_cle  := (v_base % 97)::integer;
  if v_cle = 0 then
    v_cle := 97;
  end if;

  v_douze := lpad(v_base::text, 10, '0') || lpad(v_cle::text, 2, '0');

  return '+++' || substr(v_douze, 1, 3) || '/' || substr(v_douze, 4, 4) || '/'
         || substr(v_douze, 8, 5) || '+++';
end;
$$;

alter table public.invoices
  add column if not exists communication text,
  add column if not exists quote_id uuid references public.quotes (id) on delete set null,
  add column if not exists intervention_date date,
  add column if not exists sent_at timestamptz,
  add column if not exists relances smallint not null default 0;

-- La communication est calculee DANS le declencheur de numerotation, et non
-- dans un declencheur separe.
--
-- PostgreSQL execute les declencheurs BEFORE d'une meme table par ordre
-- ALPHABETIQUE de leur nom : « invoices_communication » passerait avant
-- « invoices_numero », donc avant que le numero existe, et la communication
-- serait toujours nulle. Les fusionner supprime cette fragilite au lieu de
-- la contourner par un nom bien choisi.
create or replace function public.set_invoice_numero()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_annee    smallint := extract(year from now())::smallint;
  v_scope    text     := case when new.kind = 'avoir' then 'credit' else 'invoice' end;
  v_prefixe  text     := case when new.kind = 'avoir' then 'SUITON-A' else 'SUITON-F' end;
  v_sequence integer;
begin
  if new.numero is null or btrim(new.numero) = '' then
    v_sequence   := public.next_number(v_scope, v_annee);
    new.numero   := format('%s-%s-%s', v_prefixe, v_annee, lpad(v_sequence::text, 4, '0'));
  else
    v_sequence := coalesce(nullif(regexp_replace(new.numero, '^.*-', ''), '')::integer, 0);
  end if;

  if new.communication is null then
    new.communication := public.communication_structuree(v_sequence, v_annee);
  end if;

  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- Devis : lignes de forfait
--
-- Le gabarit SUITON decompose la prestation en forfaits, pas en prix au m².
-- Ce n'est pas cosmetique : un prix au m² affiche invite a negocier le taux,
-- un forfait se discute en bloc ou pas du tout.
--
-- La grille au m² reste le moteur de calcul ; elle n'apparait plus sur le
-- document.
-- --------------------------------------------------------------------------
alter table public.quotes
  add column if not exists acompte_montant numeric(10,2),
  add column if not exists signed_at timestamptz,
  add column if not exists signed_name text;

-- --------------------------------------------------------------------------
-- Checklist de reference
--
-- Six etapes, dans cet ordre. Elles sont en base et non dans le code : la
-- procedure evoluera avec l'experience du terrain, sans redeploiement.
-- --------------------------------------------------------------------------
create table if not exists public.checklist_steps (
  ordre       smallint primary key,
  libelle     text not null,
  detail      text not null,
  photo_requise boolean not null default false,
  actif       boolean not null default true,

  constraint checklist_ordre check (ordre between 1 and 20)
);

insert into public.checklist_steps (ordre, libelle, detail, photo_requise) values
  (1, 'État des lieux',            'Photographier chaque pièce avant toute intervention.', true),
  (2, 'Dépoussiérage haut vers bas','Plafonds, murs, corniches, radiateurs, plinthes.',    false),
  (3, 'Aspiration poussière fine', 'Deux passages. La poussière de découpe retombe.',      false),
  (4, 'Vitres et châssis',         'Intérieur, rainures, joints. Jamais en supplément.',   true),
  (5, 'Sanitaires et cuisine',     'Détartrage, robinetterie, plans de travail.',          false),
  (6, 'Sols et contrôle final',    'Lavage, puis relecture pièce par pièce.',              true)
on conflict (ordre) do nothing;

alter table public.checklist_steps enable row level security;
create policy checklist_read on public.checklist_steps for select using (auth.uid() is not null);
create policy checklist_admin on public.checklist_steps
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Rapports : signature et envoi
-- --------------------------------------------------------------------------
alter table public.reports
  add column if not exists signataire text,
  add column if not exists photos_avant smallint not null default 0,
  add column if not exists photos_apres smallint not null default 0;
