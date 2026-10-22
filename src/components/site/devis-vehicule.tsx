'use client';

import { useState } from 'react';
import { Carte } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { PrixTvac } from '@/components/site/prix-tvac';
import { cn } from '@/lib/cn';
import {
  AVERTISSEMENT_VAPEUR,
  BASE_VEHICULE,
  OPTIONS_VEHICULE,
  TAILLES_VEHICULE,
  calculerVehicule,
  eur,
  type IdOptionVehicule,
  type IdTailleVehicule,
} from '@/lib/site/tarifs-secondaires';

/**
 * Nettoyage de vehicule : la taille du vehicule fixe le prix de la base, puis
 * des options cumulables (prix identiques quelle que soit la taille). Aucune
 * duree n'est affichee : elle reste une donnee interne.
 *
 * Aucune option n'en impose une autre. Le choix (base, options, total) est transmis avec la demande, en tete du message : il arrive dans
 * le courriel interne et dans « Demandes de rappel » sans champ de plus.
 */
export function DevisVehicule() {
  const [taille, setTaille] = useState<IdTailleVehicule>('compacte');
  const [choisies, setChoisies] = useState<IdOptionVehicule[]>([]);
  const tailleActive = TAILLES_VEHICULE.find((t) => t.id === taille) ?? TAILLES_VEHICULE[0]!;
  const { htva, tvac } = calculerVehicule(taille, choisies);

  function basculer(id: IdOptionVehicule) {
    setChoisies((actuel) =>
      actuel.includes(id) ? actuel.filter((x) => x !== id) : [...actuel, id],
    );
  }

  const nomsOptions = OPTIONS_VEHICULE.filter((o) => choisies.includes(o.id)).map((o) => o.nom);
  const resume = [
    `Nettoyage véhicule (${tailleActive.nom}) : ${[BASE_VEHICULE.nom, ...nomsOptions].join(' + ')}`,
    `Total : ${eur(tvac)} TVAC (${eur(htva)} HTVA)`,
  ].join('\n');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
      <Carte className="self-start">
        <h2 className="font-heading text-base font-semibold">Composez votre nettoyage</h2>
        <p className="text-ardoise mt-1.5 text-sm">
          Choisissez la taille de votre véhicule, puis les options que vous voulez.
        </p>

        <fieldset className="mt-5">
          <legend className="text-ardoise mb-2 text-xs font-medium tracking-wide uppercase">
            Votre véhicule
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TAILLES_VEHICULE.map((t) => {
              const active = t.id === taille;
              return (
                <label
                  key={t.id}
                  className={cn(
                    'rounded-suiton min-h-touch flex cursor-pointer items-start gap-3 border p-3.5 transition-colors',
                    active ? 'border-abysse bg-white' : 'border-mineral-dark hover:border-ardoise-clair',
                  )}
                >
                  <input
                    type="radio"
                    name="taille-vehicule"
                    checked={active}
                    onChange={() => setTaille(t.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B2239]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.nom}</span>
                    <span className="text-ardoise mt-0.5 block text-xs">{t.exemples}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-suiton border-mineral-dark bg-mineral mt-5 border p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{BASE_VEHICULE.nom}</span>
            <PrixTvac tvac={tailleActive.prixTvac} avecHtva={false} className="text-sm font-semibold" />
          </div>
          <p className="text-ardoise mt-1 text-[0.8125rem] leading-relaxed">
            {BASE_VEHICULE.contenu}
          </p>
          <p className="text-ardoise mt-1 text-xs">Inclus dans tous les cas</p>
        </div>

        <fieldset className="mt-4 space-y-3">
          <legend className="text-ardoise mb-1 text-xs font-medium tracking-wide uppercase">
            Options
          </legend>
          {OPTIONS_VEHICULE.map((o) => {
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
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">+ {o.nom}</span>
                    <PrixTvac
                      tvac={o.prixTvac}
                      prefixe="+"
                      avecHtva={false}
                      className="shrink-0 text-sm font-medium"
                    />
                  </span>
                  <span className="text-ardoise mt-0.5 block text-[0.8125rem] leading-relaxed">
                    {o.contenu}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <p className="text-ardoise mt-3 text-xs leading-relaxed">{AVERTISSEMENT_VAPEUR}</p>

        <div
          className="border-mineral-dark mt-5 flex items-baseline justify-between gap-3 border-t pt-4"
          aria-live="polite"
        >
          <span className="block text-sm font-semibold">Total</span>
          <PrixTvac tvac={tvac} className="font-heading text-xl font-semibold" />
        </div>
      </Carte>

      <FormulaireRappel
        titre="Demander ce nettoyage"
        description="Votre choix est transmis avec votre demande. Nous rappelons le jour même en semaine, pour fixer le rendez-vous."
        libelleMessage="Votre véhicule"
        placeholderMessage="Marque et modèle, état général, sièges tissu ou cuir."
        libelleSubmit="Demander ce nettoyage"
        source="nettoyage-auto"
        avecEmail
        avecAdresse
        avecPhotos
        resume={resume}
        aidePhotos="Facultatif, mais utile : des photos de l'état du véhicule nous aident à préparer l'intervention."
        usagePhotos="Elles servent à préparer votre intervention."
        recap={`${tailleActive.nom} · ${[BASE_VEHICULE.nom, ...nomsOptions].join(' + ')} · ${eur(tvac)} TVAC`}
      />
    </div>
  );
}
