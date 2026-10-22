'use client';

import { useState } from 'react';
import { Carte } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { PrixTvac } from '@/components/site/prix-tvac';
import {
  AVERTISSEMENT_VAPEUR,
  CONTENU_VAPEUR_CANAPE,
  MATELAS_MAX_PAR_TAILLE,
  PLACES_MAX_CANAPE,
  PRIX_TAPIS,
  PRIX_TAPIS_SUPPLEMENTAIRE,
  TAPIS_MAX,
  TAILLES_MATELAS,
  VAPEUR_CANAPE,
  calculerCanape,
  calculerMatelas,
  calculerTapis,
  eur,
  type QuantitesMatelas,
} from '@/lib/site/tarifs-secondaires';
import { cn } from '@/lib/cn';

const CHAMP =
  'h-touch rounded-suiton border-mineral-dark tabular focus:border-ocean mt-1.5 w-28 border px-3 text-sm transition-colors duration-150 focus:outline-none';

const PALIERS_CANAPE = [2, 4, 6, 8].map((places) => ({ places, ...calculerCanape(places, false) }));

function entier(valeur: string, max: number): number {
  const n = Number.parseInt(valeur, 10);
  return Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), max);
}

/** « 12 € » ou « de 12 € à 18 € » selon que le prix est une fourchette. */
function fourchette(min: number, max: number): string {
  return min === max ? eur(min) : `de ${eur(min)} à ${eur(max)}`;
}

/**
 * Nettoyage textile : canapes, matelas, tapis. Chaque article est facultatif
 * et s'additionne aux autres ; le total est une estimation, confirmee sur
 * photos avant l'intervention. Le choix est transmis en tete du message,
 * seulement s'il y a au moins un article renseigne.
 */
export function DevisTextile() {
  const [places, setPlaces] = useState(0);
  const [vapeur, setVapeur] = useState(false);
  const [matelas, setMatelas] = useState<QuantitesMatelas>({});
  const [nbTapis, setNbTapis] = useState(0);

  const canape = places >= 1 ? calculerCanape(places, vapeur) : null;
  const lits = calculerMatelas(matelas);
  const tapis = nbTapis > 0 ? calculerTapis(nbTapis) : null;

  const lignes: { libelle: string; min: number; max: number }[] = [];
  if (canape) {
    lignes.push({
      libelle: `Canapé ${places} place${places > 1 ? 's' : ''}${vapeur ? ' + Total vapeur' : ''}`,
      min: canape.min,
      max: canape.max,
    });
  }
  if (lits.nombre > 0) {
    const detail = TAILLES_MATELAS.filter((t) => (matelas[t.id] ?? 0) > 0)
      .map((t) => `${matelas[t.id]} × ${t.nom}`)
      .join(', ');
    lignes.push({ libelle: `Matelas : ${detail}`, min: lits.min, max: lits.max });
  }
  if (tapis !== null) {
    lignes.push({
      libelle: `${nbTapis} tapis`,
      min: tapis,
      max: tapis,
    });
  }

  const totalMin = lignes.reduce((s, l) => s + l.min, 0);
  const totalMax = lignes.reduce((s, l) => s + l.max, 0);
  const avecChoix = lignes.length > 0;

  const resume = avecChoix
    ? [
        ...lignes.map((l) => `${l.libelle} — ${fourchette(l.min, l.max)} TVAC`),
        `Estimation totale : ${fourchette(totalMin, totalMax)} TVAC — prix exact confirmé sur photos`,
      ].join('\n')
    : undefined;

  const recap = avecChoix
    ? `${lignes.map((l) => l.libelle).join(' · ')} · ${fourchette(totalMin, totalMax)} TVAC`
    : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
      <Carte className="self-start">
        <h2 className="font-heading text-base font-semibold">Simulez votre nettoyage</h2>
        <p className="text-ardoise mt-1.5 text-sm leading-relaxed">
          Renseignez ce que vous voulez faire nettoyer : tout est facultatif et s&apos;additionne.
          Le prix exact est confirmé sur photos avant l&apos;intervention.
        </p>

        {/* Canapes */}
        <section className="border-mineral-dark mt-5 border-t pt-5">
          <h3 className="text-sm font-semibold">Canapés</h3>
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">
            {PALIERS_CANAPE.map((p) => `${p.places} places : ${eur(p.min)} à ${eur(p.max)}`).join(' · ')}{' '}
            TVAC, selon l&apos;état du canapé
          </p>
          <label htmlFor="canape-places" className="mt-3 block text-sm font-medium">
            Nombre de places
          </label>
          <input
            id="canape-places"
            type="number"
            inputMode="numeric"
            min={0}
            max={PLACES_MAX_CANAPE}
            value={places === 0 ? '' : places}
            onChange={(e) => setPlaces(entier(e.target.value, PLACES_MAX_CANAPE))}
            placeholder="4"
            className={CHAMP}
          />
          <label className="rounded-suiton min-h-touch border-mineral-dark hover:border-ardoise-clair mt-3 flex cursor-pointer items-start gap-3 border p-3.5 transition-colors">
            <input
              type="checkbox"
              checked={vapeur}
              onChange={(e) => setVapeur(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B2239]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">+ Total vapeur</span>
                <span className="shrink-0 text-sm font-medium">
                  <PrixTvac tvac={VAPEUR_CANAPE} prefixe="+" avecHtva={false} />
                  <span className="text-ardoise block text-right text-xs font-normal">
                    par canapé
                  </span>
                </span>
              </span>
              <span className="text-ardoise mt-0.5 block text-[0.8125rem] leading-relaxed">
                {CONTENU_VAPEUR_CANAPE} Quel que soit l&apos;état du canapé.
              </span>
            </span>
          </label>
          <p className="text-ardoise mt-2 text-xs leading-relaxed">{AVERTISSEMENT_VAPEUR}</p>
        </section>

        {/* Matelas */}
        <section className="border-mineral-dark mt-5 border-t pt-5">
          <h3 className="text-sm font-semibold">Matelas</h3>
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">
            Prix par matelas, deux faces, taches ciblées et traitement anti-acariens.
          </p>
          <div className="mt-3 space-y-2.5">
            {TAILLES_MATELAS.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`matelas-${t.id}`} className="min-w-0 text-sm">
                  <span className="block font-medium">{t.nom}</span>
                  <span className="text-ardoise tabular block text-xs">{fourchette(t.prixMin, t.prixMax)} TVAC</span>
                </label>
                <input
                  id={`matelas-${t.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MATELAS_MAX_PAR_TAILLE}
                  value={(matelas[t.id] ?? 0) === 0 ? '' : matelas[t.id]}
                  onChange={(e) =>
                    setMatelas((actuel) => ({
                      ...actuel,
                      [t.id]: entier(e.target.value, MATELAS_MAX_PAR_TAILLE),
                    }))
                  }
                  placeholder="0"
                  className={cn(CHAMP, 'mt-0 w-20 shrink-0')}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Tapis */}
        <section className="border-mineral-dark mt-5 border-t pt-5">
          <h3 className="text-sm font-semibold">Tapis</h3>
          <p className="text-ardoise mt-0.5 text-[0.8125rem]">
            {eur(PRIX_TAPIS)} TVAC pour un tapis, {eur(PRIX_TAPIS + PRIX_TAPIS_SUPPLEMENTAIRE)} pour
            deux : chaque tapis supplémentaire coûte {eur(PRIX_TAPIS_SUPPLEMENTAIRE)}.
          </p>
          <label htmlFor="tapis-nombre" className="mt-3 block text-sm font-medium">
            Nombre de tapis
          </label>
          <input
            id="tapis-nombre"
            type="number"
            inputMode="numeric"
            min={0}
            max={TAPIS_MAX}
            value={nbTapis === 0 ? '' : nbTapis}
            onChange={(e) => setNbTapis(entier(e.target.value, TAPIS_MAX))}
            placeholder="1"
            className={CHAMP}
          />
          <p className="text-ardoise mt-1.5 text-xs">
            Tapis de taille courante. Un très grand tapis, ou une matière délicate (soie, laine
            ancienne) : décrivez-le dans le formulaire, nous le chiffrons sur photos.
          </p>
        </section>

        {avecChoix ? (
          <div
            className="border-mineral-dark mt-6 flex flex-col gap-1.5 border-t pt-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
            aria-live="polite"
          >
            <span>
              <span className="block text-sm font-semibold">Estimation</span>
              <span className="text-ardoise block text-xs">confirmée sur photos</span>
            </span>
            <span className="tabular font-heading text-xl font-semibold sm:shrink-0">
              {totalMin === totalMax ? eur(totalMin) : `${eur(totalMin)} – ${eur(totalMax)}`} TVAC
            </span>
          </div>
        ) : null}
      </Carte>

      <FormulaireRappel
        titre="Demander un devis textile"
        description="Envoyez des photos de ce qu'il faut nettoyer : nous confirmons le prix exact et rappelons le jour même en semaine."
        libelleMessage="Ce que vous voulez faire nettoyer"
        placeholderMessage="Un canapé 3 places en tissu, quelques taches, et un tapis 200x300."
        source="nettoyage-textile"
        avecEmail
        avecAdresse
        avecPhotos
        resume={resume}
        aidePhotos="Facultatif, mais utile : avec des photos, nous confirmons le prix exact avant l'intervention."
        usagePhotos="Elles servent à confirmer votre prix avant l'intervention."
        recap={recap}
      />
    </div>
  );
}
