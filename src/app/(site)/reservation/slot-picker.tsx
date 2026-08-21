'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import type { Creneau } from './types';
import type { SoilLevel } from '@/types/database';

const JOUR = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const HEURE = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

/**
 * Choix du creneau.
 *
 * Les creneaux viennent de la base, avec le meme critere de chevauchement
 * que la contrainte EXCLUDE : on ne propose jamais ce que la base refusera.
 * Le creneau reste PROVISOIRE tant que le devis n'est pas accepte — c'est
 * dit explicitement, parce qu'un client qui croit sa date acquise et
 * decouvre le contraire est un client perdu.
 */
export function SlotPicker({
  surface,
  soil,
  choisi,
  onChange,
}: {
  surface: number;
  soil: SoilLevel;
  choisi: Creneau | null;
  onChange: (c: Creneau | null) => void;
}) {
  const [creneaux, setCreneaux] = useState<Creneau[] | null>(null);
  const [duree, setDuree] = useState<{ min: number; max: number } | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;

    async function charger() {
      try {
        const reponse = await fetch(`/api/slots?surface_m2=${surface}&soil=${soil}&jours=21`);
        const json = await reponse.json();
        if (annule) return;

        if (reponse.ok && json.ok) {
          setCreneaux(json.data.creneaux);
          setDuree({ min: json.data.duree_min, max: json.data.duree_max });
        } else {
          setErreur(true);
          setCreneaux([]);
        }
      } catch {
        if (!annule) {
          setErreur(true);
          setCreneaux([]);
        }
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [surface, soil]);

  const parJour = useMemo(() => {
    if (!creneaux) return [];
    const groupes = new Map<string, Creneau[]>();
    for (const c of creneaux) {
      const cle = c.debut.slice(0, 10);
      const liste = groupes.get(cle);
      if (liste) liste.push(c);
      else groupes.set(cle, [c]);
    }
    return Array.from(groupes.entries()).slice(0, 8);
  }, [creneaux]);

  if (creneaux === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {duree ? (
        <p className="text-ardoise text-sm">
          Durée estimée pour {surface} m² : {formatDuration(duree.min)} à{' '}
          {formatDuration(duree.max)}. Choisissez une date qui vous arrange — vous pourrez la
          modifier.
        </p>
      ) : null}

      {erreur || parJour.length === 0 ? (
        <Alert ton="alerte" titre="Aucun créneau à afficher">
          Passez à l&apos;étape suivante : nous vous proposerons des dates avec votre devis.
          Rien n&apos;est perdu.
        </Alert>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              'h-touch rounded-suiton flex items-center border px-3.5 text-sm transition-colors',
              choisi === null ? 'border-abysse bg-mineral font-medium' : 'border-mineral-dark',
            )}
          >
            Je préfère qu&apos;on me propose des dates
          </button>

          {parJour.map(([jour, liste]) => (
            <div key={jour}>
              <p className="mb-2 text-[0.8125rem] font-medium capitalize">
                {JOUR.format(new Date(jour))}
              </p>
              <div className="flex flex-wrap gap-2">
                {liste.map((c) => {
                  const actif = choisi?.debut === c.debut;
                  return (
                    <button
                      key={c.debut}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => onChange(c)}
                      className={cn(
                        'tabular h-touch rounded-suiton min-w-[5.5rem] border px-3 text-sm transition-colors',
                        actif
                          ? 'border-abysse bg-abysse text-mineral'
                          : 'border-mineral-dark hover:border-ardoise-clair',
                      )}
                    >
                      {HEURE.format(new Date(c.debut))}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-ardoise text-[0.8125rem]">
            Ce créneau reste <strong>provisoire</strong> jusqu&apos;à l&apos;acceptation du
            devis. Il n&apos;est bloqué fermement qu&apos;à ce moment-là.
          </p>
        </>
      )}
    </div>
  );
}
