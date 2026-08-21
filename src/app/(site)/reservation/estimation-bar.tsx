'use client';

import { useMemo } from 'react';
import { estimate } from '@/lib/pricing';
import { zonePourCodePostal } from '@/lib/zones';
import { formatRange } from '@/lib/format';
import type { GrillePublique, EtatReservation } from './types';
import type { SettingsRow } from '@/types/database';

/**
 * Barre d'estimation.
 *
 * Elle utilise `lib/pricing` — exactement la meme fonction que le serveur.
 * C'est la seule facon de garantir que le chiffre annonce au visiteur est
 * celui qui figurera sur son devis : deux implementations divergeraient au
 * premier changement de grille.
 */
export function EstimationBar({
  etat,
  grille,
}: {
  etat: EtatReservation;
  grille: GrillePublique;
}) {
  const resultat = useMemo(() => {
    const surface = typeof etat.surface_m2 === 'number' ? etat.surface_m2 : 0;
    if (surface < 10) return null;

    const zone =
      etat.code_postal.length === 4 ? zonePourCodePostal(etat.code_postal) : 'principale';

    try {
      return estimate(
        {
          service: etat.service,
          soil: etat.soil,
          surface_m2: surface,
          zone,
          urgent: etat.urgent,
          property_type: etat.property_type,
        },
        grille as SettingsRow,
      );
    } catch {
      return null;
    }
  }, [
    etat.service,
    etat.soil,
    etat.surface_m2,
    etat.code_postal,
    etat.urgent,
    grille,
    etat.property_type,
  ]);

  if (!resultat) return null;

  return (
    <div
      aria-live="polite"
      className="border-mineral-dark sm:rounded-suiton sticky bottom-0 z-10 -mx-4 border-t bg-white px-4 py-3 sm:mx-0 sm:border"
    >
      {resultat.surDevis ? (
        <>
          <p className="text-ardoise text-[0.8125rem]">Estimation</p>
          <p className="font-heading text-aqua-deep text-lg font-semibold">Sur devis</p>
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">
            Surface ou zone hors barème standard. Nous chiffrons au cas par cas.
          </p>
        </>
      ) : (
        <>
          <p className="text-ardoise text-[0.8125rem]">Estimation, hors TVA</p>
          <p className="tabular font-heading text-lg font-semibold">
            {formatRange(resultat.min, resultat.max)}
          </p>
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">
            Vitres et châssis compris. Devis ferme sous {grille.delai_devis_heures} h.
          </p>
        </>
      )}
    </div>
  );
}
