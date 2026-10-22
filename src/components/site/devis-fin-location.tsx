'use client';

import { useState } from 'react';
import { Carte } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { PrixTvac } from '@/components/site/prix-tvac';
import { cn } from '@/lib/cn';
import {
  FIN_LOCATION,
  OPTIONS_FIN_LOCATION,
  calculerFinLocation,
  eur,
  type OptionFinLocation,
} from '@/lib/site/tarifs-secondaires';

/**
 * Fin de location : un forfait pour un logement jusqu'a 90 m², devis au-dela.
 * Refrigerateur et textiles sont hors forfait : on les coche pour les
 * signaler, ils sont chiffres au rappel. Le choix part en tete du message.
 */
export function DevisFinLocation() {
  const [surface, setSurface] = useState('');
  const [choisies, setChoisies] = useState<OptionFinLocation['id'][]>([]);

  const m2 = Number.parseFloat(surface.replace(',', '.'));
  const surfaceValide = Number.isFinite(m2) && m2 > 0;
  const { statut, tvac } = calculerFinLocation(surfaceValide ? m2 : null);

  function basculer(id: OptionFinLocation['id']) {
    setChoisies((actuel) =>
      actuel.includes(id) ? actuel.filter((x) => x !== id) : [...actuel, id],
    );
  }

  const nomsOptions = OPTIONS_FIN_LOCATION.filter((o) => choisies.includes(o.id)).map(
    (o) => o.nom,
  );
  const prixTexte =
    statut === 'forfait' && tvac !== null ? `${eur(tvac)} TVAC` : 'sur devis';
  const logement = surfaceValide ? `logement de ${String(m2).replace('.', ',')} m²` : 'logement';

  const resume = [
    `Nettoyage de fin de location : ${logement} — ${prixTexte}`,
    nomsOptions.length > 0
      ? `Hors forfait, à chiffrer : ${nomsOptions.join(', ')}`
      : null,
    "Rappel : le nettoyage de l'électroménager n'est pas compris dans le forfait.",
  ]
    .filter(Boolean)
    .join('\n');

  const recap = `Fin de location · ${logement} · ${prixTexte}${
    nomsOptions.length > 0 ? ` · à chiffrer : ${nomsOptions.join(', ').toLowerCase()}` : ''
  }`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
      <Carte className="self-start">
        <h2 className="font-heading text-base font-semibold">Votre fin de location</h2>
        <p className="text-ardoise mt-1.5 text-sm">
          Un forfait pour un logement jusqu&apos;à {FIN_LOCATION.surfaceMax} m². Indiquez la
          surface si vous la connaissez.
        </p>

        <div className="rounded-suiton border-mineral-dark bg-mineral mt-5 border p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">Forfait fin de location</span>
            <PrixTvac
              tvac={FIN_LOCATION.forfaitTvac}
              avecHtva={false}
              className="text-sm font-semibold"
            />
          </div>
          <p className="text-ardoise mt-1 text-[0.8125rem] leading-relaxed">
            Nettoyage complet du logement pour l&apos;état des lieux de sortie : sols, cuisine,
            salle de bains et sanitaires, portes, plinthes et surfaces.
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed font-medium">
            Le nettoyage de l&apos;électroménager n&apos;est pas compris.
          </p>
        </div>

        <div className="mt-5">
          <label htmlFor="location-surface" className="block text-sm font-medium">
            Surface du logement en m² <span className="text-ardoise font-normal">— facultatif</span>
          </label>
          <input
            id="location-surface"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            placeholder="75"
            className="h-touch rounded-suiton border-mineral-dark tabular focus:border-ocean mt-1.5 w-32 border px-3 text-sm transition-colors duration-150 focus:outline-none"
          />
          {statut === 'devis' ? (
            <p className="text-ardoise mt-2 text-[0.8125rem] leading-relaxed" role="status">
              Au-delà de {FIN_LOCATION.surfaceMax} m², nous chiffrons sur devis : décrivez votre
              logement dans le formulaire, nous vous rappelons.
            </p>
          ) : null}
        </div>

        <fieldset className="mt-5 space-y-3">
          <legend className="text-ardoise mb-1 text-xs font-medium tracking-wide uppercase">
            Hors forfait, chiffré sur demande
          </legend>
          {OPTIONS_FIN_LOCATION.map((o) => {
            const active = choisies.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  'rounded-suiton min-h-touch flex cursor-pointer items-start gap-3 border p-3.5 transition-colors',
                  active ? 'border-abysse bg-white' : 'border-mineral-dark hover:border-ardoise-clair',
                )}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => basculer(o.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B2239]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">+ {o.nom}</span>
                  <span className="text-ardoise mt-0.5 block text-[0.8125rem] leading-relaxed">
                    {o.contenu}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div
          className="border-mineral-dark mt-5 flex items-baseline justify-between gap-3 border-t pt-4"
          aria-live="polite"
        >
          <span>
            <span className="block text-sm font-semibold">Total</span>
            {nomsOptions.length > 0 ? (
              <span className="text-ardoise block text-xs">+ options à chiffrer</span>
            ) : null}
          </span>
          {statut === 'forfait' && tvac !== null ? (
            <PrixTvac tvac={tvac} className="font-heading text-xl font-semibold" />
          ) : (
            <span className="font-heading text-xl font-semibold">Sur devis</span>
          )}
        </div>
      </Carte>

      <FormulaireRappel
        titre="Demander ce nettoyage"
        description="Votre choix est transmis avec votre demande. Nous rappelons le jour même en semaine, pour fixer le rendez-vous."
        libelleMessage="Votre logement"
        placeholderMessage="Appartement 2 chambres au 3e étage, état des lieux le 30, réfrigérateur à nettoyer."
        libelleSubmit="Demander ce nettoyage"
        source="fin-de-location"
        avecEmail
        avecAdresse
        avecPhotos
        resume={resume}
        aidePhotos="Facultatif, mais utile : des photos de l'état du logement nous aident à préparer l'intervention."
        usagePhotos="Elles servent à préparer votre intervention."
        recap={recap}
      />
    </div>
  );
}
