'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { PhotoDeposee } from './types';

const MAX_PHOTOS = 8;

/**
 * Depot de photos.
 *
 * Le fichier part vers /api/photos/upload, qui le re-encode et supprime les
 * metadonnees AVANT stockage. Il n'existe volontairement pas d'URL signee
 * remise au navigateur : elle laisserait deposer le JPEG brut, coordonnees
 * GPS du domicile comprises.
 *
 * `capture="environment"` ouvre directement l'appareil photo arriere sur
 * mobile — c'est la situation reelle : le client est sur place.
 */
export function PhotoUploader({
  photos,
  onChange,
  onErreur,
}: {
  photos: PhotoDeposee[];
  onChange: (photos: PhotoDeposee[]) => void;
  onErreur: (message: string | null) => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(0);

  async function deposer(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    onErreur(null);

    const place = MAX_PHOTOS - photos.length;
    const lot = Array.from(fichiers).slice(0, place);

    if (fichiers.length > place) {
      onErreur(`${MAX_PHOTOS} photos au maximum. Les suivantes ont été ignorées.`);
    }

    setEnCours(lot.length);
    const ajoutees: PhotoDeposee[] = [];

    for (const fichier of lot) {
      const corps = new FormData();
      corps.append('fichier', fichier);

      try {
        const reponse = await fetch('/api/photos/upload', { method: 'POST', body: corps });
        const json = await reponse.json();

        if (reponse.ok && json.ok) {
          ajoutees.push({ id: json.data.id, apercu: json.data.apercu, nom: fichier.name });
        } else {
          onErreur(json.error ?? `« ${fichier.name} » n'a pas pu être envoyée.`);
        }
      } catch {
        onErreur(`« ${fichier.name} » n'a pas pu être envoyée.`);
      } finally {
        setEnCours((n) => n - 1);
      }
    }

    if (ajoutees.length) onChange([...photos, ...ajoutees]);
    if (champ.current) champ.current.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ardoise text-sm">
        Facultatif, mais utile : avec des photos, notre devis est ferme plutôt
        qu&apos;indicatif, et nous arrivons avec le bon matériel.
      </p>

      <input
        ref={champ}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        capture="environment"
        onChange={(e) => deposer(e.target.files)}
        className="sr-only"
        id="depot-photos"
      />

      <Button
        variant="secondaire"
        size="lg"
        onClick={() => champ.current?.click()}
        disabled={photos.length >= MAX_PHOTOS || enCours > 0}
      >
        {enCours > 0
          ? `Envoi de ${enCours} photo${enCours > 1 ? 's' : ''}…`
          : photos.length === 0
            ? 'Ajouter des photos'
            : `Ajouter (${photos.length}/${MAX_PHOTOS})`}
      </Button>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <span className="rounded-suiton border-mineral-dark bg-mineral block aspect-square overflow-hidden border">
                {photo.apercu ? (
                  <Image
                    src={photo.apercu}
                    alt=""
                    width={200}
                    height={200}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
                className="bg-abysse/85 text-mineral absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full"
              >
                <span className="sr-only">Retirer {photo.nom}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2 2l8 8M10 2l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Alert ton="info" titre="Ce que deviennent vos photos">
        Elles servent à chiffrer votre chantier et à constituer votre rapport avant/après. Les
        données de localisation contenues dans les fichiers sont supprimées dès la réception.
        Rien n&apos;est publié sans votre accord explicite.
      </Alert>
    </div>
  );
}
