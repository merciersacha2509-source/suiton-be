-- ===========================================================================
-- Nouvelle source de demande de rappel : nettoyage de fin de location
-- ===========================================================================
-- La page /nettoyage-fin-de-location envoie ses demandes par le meme
-- formulaire de rappel que l'auto et le textile. Sans cette valeur, l'insertion
-- dans `rappels` echouerait (enum), et la demande ne serait pas retrouvable
-- dans le tableau de bord. Ajout non destructif : aucune ligne existante
-- n'est modifiee.
-- ===========================================================================

alter type public.rappel_source add value if not exists 'fin-de-location';
