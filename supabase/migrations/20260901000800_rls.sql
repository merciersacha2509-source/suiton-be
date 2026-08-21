-- ===========================================================================
-- SUITON OS 1.0 — Sprint 1 — Row Level Security
-- ===========================================================================
-- Principe : la RLS est la DERNIERE ligne de defense, pas la seule. Le code
-- filtre deja ; la base refuse quand meme. Une faille dans une route ne doit
-- pas suffire a exposer le fichier client.
--
-- Le role anon n'a AUCUN acces en ecriture directe. La reservation publique
-- (Sprint 2) passe par une Server Action qui valide puis ecrit avec la clé
-- de service : le formulaire public n'a jamais de credential en base.
-- ===========================================================================

alter table public.profiles         enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.clients          enable row level security;
alter table public.partners         enable row level security;
alter table public.partner_users    enable row level security;
alter table public.jobs             enable row level security;
alter table public.quotes           enable row level security;
alter table public.invoices         enable row level security;
alter table public.interventions    enable row level security;
alter table public.photos           enable row level security;
alter table public.reports          enable row level security;
alter table public.reviews          enable row level security;
alter table public.messages         enable row level security;
alter table public.events           enable row level security;
alter table public.score_events     enable row level security;
alter table public.automations      enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.settings         enable row level security;
alter table public.settings_history enable row level security;
alter table public.counters         enable row level security;

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role_of());

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- teams / team_members — lisibles par tout utilisateur authentifie,
-- modifiables par l'administrateur seul.
-- --------------------------------------------------------------------------
create policy teams_read on public.teams
  for select using (auth.uid() is not null);
create policy teams_admin on public.teams
  for all using (public.is_admin()) with check (public.is_admin());

create policy team_members_read on public.team_members
  for select using (auth.uid() is not null);
create policy team_members_admin on public.team_members
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- clients — le fichier client est reserve au bureau.
-- Un technicien n'y a AUCUN acces : son telephone peut etre perdu ou vole.
-- --------------------------------------------------------------------------
create policy clients_staff on public.clients
  for all using (public.is_staff()) with check (public.is_staff());

-- --------------------------------------------------------------------------
-- partners / partner_users
-- --------------------------------------------------------------------------
create policy partners_staff on public.partners
  for all using (public.is_staff()) with check (public.is_staff());

create policy partners_self_read on public.partners
  for select using (
    exists (
      select 1 from public.partner_users pu
      where pu.partner_id = partners.id and pu.profile_id = auth.uid()
    )
  );

create policy partner_users_staff on public.partner_users
  for all using (public.is_staff()) with check (public.is_staff());

create policy partner_users_self_read on public.partner_users
  for select using (profile_id = auth.uid());

-- --------------------------------------------------------------------------
-- jobs
--   staff       : tout
--   technicien  : uniquement les chantiers ou son equipe intervient
--   partenaire  : uniquement les chantiers de son entreprise
-- --------------------------------------------------------------------------
create policy jobs_staff on public.jobs
  for all using (public.is_staff()) with check (public.is_staff());

create policy jobs_technicien_read on public.jobs
  for select using (
    public.current_role_of() = 'technicien'
    and exists (
      select 1 from public.interventions i
      where i.job_id = jobs.id
        and i.team_id in (select public.my_team_ids())
        and i.status <> 'annule'
    )
  );

create policy jobs_partenaire_read on public.jobs
  for select using (
    jobs.partner_id is not null
    and exists (
      select 1 from public.partner_users pu
      where pu.partner_id = jobs.partner_id and pu.profile_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- quotes / invoices — montants. Jamais visibles d'un technicien.
-- Cote partenaire, seul le responsable voit les factures.
-- --------------------------------------------------------------------------
create policy quotes_staff on public.quotes
  for all using (public.is_staff()) with check (public.is_staff());

create policy invoices_staff_read on public.invoices
  for select using (public.is_staff());
create policy invoices_staff_write on public.invoices
  for insert with check (public.is_staff());
create policy invoices_staff_update on public.invoices
  for update using (public.is_staff()) with check (public.is_staff());
-- Une facture ne se supprime pas : elle s'annule par un avoir.
create policy invoices_admin_delete on public.invoices
  for delete using (false);

create policy invoices_partenaire_read on public.invoices
  for select using (
    invoices.partner_id is not null
    and exists (
      select 1 from public.partner_users pu
      where pu.partner_id = invoices.partner_id
        and pu.profile_id = auth.uid()
        and pu.responsable
    )
  );

-- --------------------------------------------------------------------------
-- interventions — le technicien voit et fait avancer celles de son equipe.
-- --------------------------------------------------------------------------
create policy interventions_staff on public.interventions
  for all using (public.is_staff()) with check (public.is_staff());

create policy interventions_technicien_read on public.interventions
  for select using (team_id in (select public.my_team_ids()));

create policy interventions_technicien_update on public.interventions
  for update using (team_id in (select public.my_team_ids()))
  with check (team_id in (select public.my_team_ids()));

create policy interventions_partenaire_read on public.interventions
  for select using (
    exists (
      select 1
      from public.jobs j
      join public.partner_users pu on pu.partner_id = j.partner_id
      where j.id = interventions.job_id and pu.profile_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- photos / reports — produits sur le terrain.
-- --------------------------------------------------------------------------
create policy photos_staff on public.photos
  for all using (public.is_staff()) with check (public.is_staff());

create policy photos_technicien on public.photos
  for all using (
    exists (
      select 1 from public.interventions i
      where i.job_id = photos.job_id and i.team_id in (select public.my_team_ids())
    )
  ) with check (
    exists (
      select 1 from public.interventions i
      where i.job_id = photos.job_id and i.team_id in (select public.my_team_ids())
    )
  );

create policy reports_staff on public.reports
  for all using (public.is_staff()) with check (public.is_staff());

create policy reports_technicien on public.reports
  for select using (
    exists (
      select 1 from public.interventions i
      where i.job_id = reports.job_id and i.team_id in (select public.my_team_ids())
    )
  );

create policy reports_technicien_insert on public.reports
  for insert with check (
    exists (
      select 1 from public.interventions i
      where i.job_id = reports.job_id and i.team_id in (select public.my_team_ids())
    )
  );

-- --------------------------------------------------------------------------
-- reviews / messages / events
-- --------------------------------------------------------------------------
create policy reviews_staff on public.reviews
  for all using (public.is_staff()) with check (public.is_staff());

create policy messages_staff on public.messages
  for all using (public.is_staff()) with check (public.is_staff());

create policy events_staff_read on public.events
  for select using (public.is_staff());
create policy events_staff_insert on public.events
  for insert with check (auth.uid() is not null);

create policy score_events_staff on public.score_events
  for select using (public.is_staff());

-- --------------------------------------------------------------------------
-- Systeme — reserve a l'administrateur.
-- --------------------------------------------------------------------------
create policy automations_staff_read on public.automations
  for select using (public.is_staff());
create policy automations_admin on public.automations
  for all using (public.is_admin()) with check (public.is_admin());

create policy audit_logs_admin_read on public.audit_logs
  for select using (public.is_admin());

create policy settings_read on public.settings
  for select using (auth.uid() is not null);
create policy settings_admin_update on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

create policy settings_history_admin on public.settings_history
  for select using (public.is_admin());

-- counters : aucune politique permissive. Seules les fonctions SECURITY
-- DEFINER y touchent. Un client qui pourrait lire ce compteur connaitrait
-- votre volume d'affaires.
