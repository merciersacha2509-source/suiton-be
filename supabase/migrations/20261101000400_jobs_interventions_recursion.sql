-- ===========================================================================
-- SUITON OS 1.0 — Casse la recursion RLS entre jobs et interventions
-- ===========================================================================
-- `jobs_technicien_read` (migration 20260901000800) verifie l'acces via un
-- EXISTS direct sur `interventions`. Cette sous-requete s'execute sous le
-- role appelant, RLS de `interventions` comprise — qui contient a son tour
-- `interventions_partenaire_read`, un EXISTS sur `jobs`. Postgres detecte
-- la boucle et refuse purement et simplement de lire `jobs`, quel que soit
-- le role : « infinite recursion detected in policy for relation jobs ».
--
-- La migration d'origine a deja resolu exactement ce probleme pour
-- `profiles` (cf. le commentaire au-dessus de `current_role_of()`) avec une
-- fonction SECURITY DEFINER : appelee ainsi, la sous-requete s'execute avec
-- les privileges du proprietaire de la fonction, pas ceux de l'appelant, et
-- ne redeclenche donc pas la RLS de la table qu'elle interroge. Le meme
-- remede, applique ici a la seule verification qui manquait.
-- ===========================================================================

create or replace function public.job_a_intervention_active_pour_equipe(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.interventions i
    where i.job_id = p_job_id
      and i.team_id in (select public.my_team_ids())
      and i.status <> 'annule'
  )
$$;

drop policy if exists jobs_technicien_read on public.jobs;

create policy jobs_technicien_read on public.jobs
  for select using (
    public.current_role_of() = 'technicien'
    and public.job_a_intervention_active_pour_equipe(jobs.id)
  );
