'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { estimate, estimateDuration, type GrillePublique } from '@/lib/pricing';
import { zonePourCodePostal } from '@/lib/zones';
import type { ServiceType, SoilLevel, PropertyType } from '@/types/database';
import { cn } from '@/lib/cn';

/** Coche dessinee : pas de police d'icones sur le chemin critique. */
function Coche() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <path
        d="M3 8.5l3.2 3.2L13 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Calculateur public.
 *
 * Il utilise `estimate()` — la meme fonction que le devis et le tableau de
 * bord. Il n'existe pas de « prix du site » distinct du prix reel : c'est la
 * seule maniere d'eviter qu'un visiteur voie 1 200 € ici et 1 600 € sur son
 * devis, ce qui coute plus cher qu'un lead perdu.
 *
 * La grille est transmise par le serveur au chargement : aucune requete au
 * changement de curseur, donc aucune latence percue et aucun INP degrade.
 *
 * Ce que le calculateur affiche est une FOURCHETTE, presentee comme telle.
 * Un chiffre unique donnerait une precision que la donnee ne porte pas.
 */

/*
 * Le calculateur ne sert plus que le nettoyage de fin de travaux : les
 * vitres seules n'ont plus d'estimation automatique (devis apres visite,
 * voir /nettoyage-de-vitres) et il n'existe plus qu'une seule prestation
 * "chantier" — plus de choix de service a faire ici.
 */
const SERVICE_UNIQUE: ServiceType = 'fin_de_chantier';

const BIENS: { valeur: PropertyType; label: string }[] = [
  { valeur: 'appartement', label: 'Appartement' },
  { valeur: 'maison', label: 'Maison' },
  { valeur: 'villa', label: 'Villa' },
  { valeur: 'bureaux', label: 'Bureaux' },
];

const SALISSURES: { valeur: SoilLevel; label: string; aide: string }[] = [
  { valeur: 'standard', label: 'Standard', aide: 'Poussière de ponçage, traces de peinture' },
  { valeur: 'lourd', label: 'Lourd', aide: 'Ciment, colle, silicone, enduit' },
];

const euros = (n: number) =>
  new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace(/ | /g, ' ');

export function Calculateur({
  settings,
  codePostalInitial = '7850',
  compact = false,
}: {
  settings: GrillePublique;
  codePostalInitial?: string;
  compact?: boolean;
}) {
  const [bien, setBien] = useState<PropertyType>('maison');
  const [soil, setSoil] = useState<SoilLevel>('standard');
  const [surface, setSurface] = useState(120);
  const [codePostal, setCodePostal] = useState(codePostalInitial);
  const [urgent, setUrgent] = useState(false);

  const zone = useMemo(() => zonePourCodePostal(codePostal), [codePostal]);

  const resultat = useMemo(() => {
    try {
      return {
        prix: estimate(
          { service: SERVICE_UNIQUE, soil, surface_m2: surface, zone, urgent, property_type: bien },
          settings,
        ),
        duree: estimateDuration({ surface_m2: surface, soil }),
      };
    } catch {
      return null;
    }
  }, [bien, soil, surface, zone, urgent, settings]);

  const lien =
    `/reservation?service=${SERVICE_UNIQUE}&surface=${surface}&salissure=${soil}` +
    `&cp=${codePostal}&bien=${bien}${urgent ? '&urgent=1' : ''}`;

  const heures = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'rounded-suiton border-mineral-dark border bg-white shadow-sm',
        compact ? 'p-5' : 'p-6 sm:p-8',
      )}
    >
      <p className="text-aqua-deep mb-6 inline-flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
        <span className="bg-aqua-deep h-1 w-1 shrink-0 rounded-full" aria-hidden />
        Simulateur SUITON
      </p>

      <div className="space-y-6">
        <fieldset>
          <legend className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] uppercase">
            <span className="bg-ardoise-clair h-1 w-1 shrink-0 rounded-full" aria-hidden />
            Type de bien
          </legend>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {BIENS.map((b) => (
              <button
                key={b.valeur}
                type="button"
                onClick={() => setBien(b.valeur)}
                aria-pressed={bien === b.valeur}
                className={cn(
                  'h-touch rounded-suiton border px-1 text-[0.75rem] font-medium transition-[background-color,border-color,transform,box-shadow] duration-200',
                  bien === b.valeur
                    ? 'border-abysse bg-abysse text-mineral shadow-sm'
                    : 'border-mineral-dark hover:border-aqua-deep/50 hover:-translate-y-px hover:shadow-sm active:translate-y-0 bg-white text-abysse',
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="calc-surface"
              className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] uppercase"
            >
              <span className="bg-ardoise-clair h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Surface
            </label>
            <span className="font-heading tabular text-lg font-semibold">{surface} m²</span>
          </div>
          <div className="relative mt-6 pt-6">
            <div
              className="rounded-suiton bg-abysse text-mineral tabular pointer-events-none absolute -top-1 flex h-7 -translate-x-1/2 items-center px-2 text-xs font-semibold shadow-sm transition-[left] duration-150"
              style={{ left: `${((surface - 20) / (500 - 20)) * 100}%` }}
              aria-hidden
            >
              {surface} m²
              <span className="border-t-abysse absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent" />
            </div>
            <input
              id="calc-surface"
              type="range"
              min={20}
              max={500}
              step={10}
              value={surface}
              onChange={(e) => setSurface(Number(e.target.value))}
              className="curseur-suiton bg-mineral-dark accent-ocean h-1.5 w-full cursor-pointer rounded-full"
            />
          </div>
          <div className="text-ardoise-clair mt-1 flex justify-between text-[0.6875rem]">
            <span>20 m²</span>
            <span>500 m²</span>
          </div>
        </div>

        <fieldset className="border-mineral-dark border-t pt-6">
          <legend className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] uppercase">
            <span className="bg-ardoise-clair h-1 w-1 shrink-0 rounded-full" aria-hidden />
            Niveau de salissure
          </legend>
          <div className="mt-3 space-y-2">
            {SALISSURES.map((s) => (
              <button
                key={s.valeur}
                type="button"
                onClick={() => setSoil(s.valeur)}
                aria-pressed={soil === s.valeur}
                className={cn(
                  'rounded-suiton flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-[background-color,border-color,transform,box-shadow] duration-200',
                  soil === s.valeur
                    ? 'border-abysse bg-mineral shadow-sm'
                    : 'border-mineral-dark hover:border-aqua-deep/50 hover:-translate-y-px hover:shadow-sm active:translate-y-0 bg-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    soil === s.valeur ? 'border-abysse bg-abysse' : 'border-mineral-dark',
                  )}
                >
                  {soil === s.valeur ? (
                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3 8.5l3.2 3.2L13 5"
                        stroke="white"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="text-ardoise block text-xs">{s.aide}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="calc-cp"
              className="text-ardoise inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] uppercase"
            >
              <span className="bg-ardoise-clair h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Code postal
            </label>
            <input
              id="calc-cp"
              inputMode="numeric"
              maxLength={4}
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, ''))}
              className="h-touch rounded-suiton border-mineral-dark tabular focus:border-ocean mt-2 w-full border px-3 text-sm transition-colors duration-150 focus:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-end gap-3 pb-1">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="accent-ocean h-4 w-4"
            />
            <span className="text-sm">
              Intervention urgente
              <span className="text-ardoise block text-xs">Sous 48 h</span>
            </span>
          </label>
        </div>
      </div>

      <div className="border-mineral-dark mt-6 border-t pt-6">
        {resultat === null ? (
          <p className="text-ardoise text-sm">
            Cette combinaison demande un devis sur mesure. Appelez-nous, c&apos;est plus rapide.
          </p>
        ) : resultat.prix.surDevis ? (
          <div>
            <p className="font-heading text-xl font-semibold">Devis sur mesure</p>
            <p className="text-ardoise mt-1 text-sm">
              {surface > settings.seuil_surface_devis
                ? `Au-delà de ${settings.seuil_surface_devis} m², le prix dépend trop de la configuration des lieux pour être estimé en ligne honnêtement.`
                : 'Ce code postal sort de notre zone habituelle : nous vérifions la faisabilité avant de vous annoncer un prix.'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-aqua-deep inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] uppercase">
              <span className="bg-aqua-deep h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Estimation indicative
            </p>
            <p className="font-heading tabular text-abysse mt-1 text-3xl font-semibold">
              {euros(resultat.prix.min)} – {euros(resultat.prix.max)}
            </p>
            <p className="text-ardoise mt-1 text-xs">
              Hors TVA · {heures(resultat.duree.min)} à {heures(resultat.duree.max)}{' '}
              d&apos;intervention
              {zone === 'secondaire' ? ' · frais de déplacement inclus' : ''}
            </p>
            <p className="border-aqua-deep/25 bg-aqua-wash text-aqua-deep rounded-suiton mt-3 flex items-start gap-2 border p-2.5 text-xs leading-relaxed">
              <Coche />
              <span>
                <strong className="font-semibold">Vitres, châssis et seuils compris</strong>{' '}
                dans ce prix. Jamais en supplément, jamais ajoutés le jour du chantier.
              </span>
            </p>
            <p className="text-ardoise mt-3 text-xs leading-relaxed">
              Fourchette calculée sur le bien, la surface et le niveau de salissure annoncés. Le
              devis, lui, est ferme : il vous engage sur un montant, pas sur une plage.
            </p>
          </div>
        )}

        <Link
          href={lien}
          className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 mt-5 flex w-full items-center justify-center px-4 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
        >
          Obtenir un devis ferme sous 24 h
        </Link>
        <p className="text-ardoise mt-2 text-center text-xs">
          Gratuit, sans engagement — 2 minutes
        </p>
      </div>
    </div>
  );
}
