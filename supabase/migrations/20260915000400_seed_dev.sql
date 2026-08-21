-- ===========================================================================
-- SUITON OS 1.0 — Sprint 2 — Donnees de developpement
-- ===========================================================================
-- Ce fichier ne s'execute qu'en local (supabase db reset). Il n'est PAS
-- rejoue en production : les migrations de production s'arretent a 300.
--
-- Il ne cree aucun compte : ceux-ci se creent depuis Authentication, et le
-- trigger on_auth_user_created fait le reste.
-- ===========================================================================

do $$
begin
  if current_setting('app.environnement', true) is distinct from 'production' then
    -- Jours feries belges 2026 pertinents pour le planning.
    insert into public.blackout_dates (jour, motif) values
      ('2026-11-01', 'Toussaint'),
      ('2026-11-11', 'Armistice'),
      ('2026-12-25', 'Noel'),
      ('2027-01-01', 'Nouvel An')
    on conflict (jour) do nothing;
  end if;
end $$;
