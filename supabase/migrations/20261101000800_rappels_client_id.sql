-- ===========================================================================
-- Rattachement automatique d'une demande de rappel a sa fiche client
-- ===========================================================================
-- Jusqu'ici, une vraie demande arrivee par "rappel" (Auto, Textile, Vitres,
-- Contact) exigeait une copie manuelle en SQL pour apparaitre dans Clients —
-- trois fois de suite avec de vraies demandes (Amelie, Bilal, Melanie). La
-- colonne ci-dessous permet a `enregistrerRappel` (src/lib/services/rappels.ts)
-- de retrouver ou creer la fiche client au moment de l'enregistrement, comme
-- le fait deja `create_booking` pour le parcours de reservation.
-- ===========================================================================

alter table public.rappels
  add column client_id uuid references public.clients (id) on delete set null;

create index rappels_client_idx on public.rappels (client_id);
