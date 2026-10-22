'use client';

import { useState } from 'react';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { cn } from '@/lib/cn';
import { PhotoUploader, type PhotoDeposee } from '@/components/site/photo-uploader';

/**
 * Formulaire de rappel.
 *
 * Trois champs, dont un facultatif. Chaque champ supplementaire coute des
 * envois : on ne demande donc que ce qui permet de rappeler.
 *
 * Le bouton reste actif tant que la requete n'est pas partie, et l'etat
 * d'envoi est annonce aux lecteurs d'ecran par `aria-live`. Une confirmation
 * qui n'existe que visuellement n'est pas une confirmation.
 */
export function FormulaireRappel({
  titre = 'Faites-vous rappeler',
  description = 'Deux champs. Nous rappelons le jour même en semaine.',
  libelleMessage = 'Votre chantier',
  placeholderMessage = 'Maison de 140 m² à Enghien, fin de travaux, réception le 12.',
  libelleSubmit = 'Demander un rappel',
  avecPhotos = false,
  avecEmail = false,
  avecAdresse = false,
  source,
  resume,
  recap,
  aidePhotos,
  usagePhotos,
  id,
}: {
  titre?: string;
  description?: string;
  libelleMessage?: string;
  placeholderMessage?: string;
  libelleSubmit?: string;
  /** Ajoute une zone de depot de photos reelle (Supabase Storage), pas simulee. */
  avecPhotos?: boolean;
  /** Ajoute un champ e-mail facultatif — utile quand une confirmation ecrite compte. */
  avecEmail?: boolean;
  /** Ajoute un champ adresse facultatif — utile pour une prestation a domicile. */
  avecAdresse?: boolean;
  /** Page d'origine : rend la demande retrouvable dans le tableau de bord. */
  source: 'contact' | 'nettoyage-auto' | 'nettoyage-textile' | 'fin-de-location' | 'vitres';
  /** Choix du client (base, options, total) : place en tete du message transmis. */
  resume?: string;
  /** Version lisible du choix, affichee au-dessus du bouton d'envoi. */
  recap?: string;
  /** Textes de la zone photos, quand ceux d'un chantier ne conviennent pas. */
  aidePhotos?: string;
  usagePhotos?: string;
  id?: string;
}) {
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoDeposee[]>([]);

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    setEtat('envoi');
    setErreur(null);

    try {
      const reponse = await fetch('/api/rappel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nom: String(donnees.get('nom') ?? ''),
          telephone: String(donnees.get('telephone') ?? ''),
          email: String(donnees.get('email') ?? ''),
          adresse: String(donnees.get('adresse') ?? ''),
          message: [resume, String(donnees.get('message') ?? '').trim()]
            .filter(Boolean)
            .join('\n\n'),
          source,
          photos: photos.map((p) => p.id),
          honeypot: String(donnees.get('societe') ?? ''),
        }),
      });

      const corps = (await reponse.json().catch(() => null)) as {
        ok: boolean;
        error?: string;
        issues?: { message: string }[];
      } | null;

      if (!reponse.ok || !corps?.ok) {
        setErreur(
          corps?.issues?.[0]?.message ??
            corps?.error ??
            'Envoi impossible. Appelez-nous, c’est plus rapide.',
        );
        setEtat('erreur');
        return;
      }
      setEtat('ok');
    } catch {
      setErreur('Connexion interrompue. Appelez-nous, c’est plus rapide.');
      setEtat('erreur');
    }
  }

  if (etat === 'ok') {
    return (
      <div role="status" className="rounded-suiton border-aqua-deep/25 bg-aqua-wash border p-6">
        <h3 className="font-heading text-abysse text-base font-semibold">
          C&apos;est noté, nous vous rappelons.
        </h3>
        <p className="text-abysse/80 mt-2 text-sm leading-relaxed">
          Le jour même si vous écrivez en semaine avant 16 h, le lendemain matin sinon. Si
          c&apos;est urgent, appelez directement le{' '}
          <a href={`tel:${ENTREPRISE.telephoneE164}`} className="font-medium underline">
            {ENTREPRISE.telephone}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={soumettre}
      className="rounded-suiton border-mineral-dark border bg-white p-6 shadow-sm"
    >
      <h3 className="font-heading text-base font-semibold">{titre}</h3>
      <p className="text-ardoise mt-1.5 text-sm">{description}</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="rappel-nom" className="block text-sm font-medium">
            Votre nom
          </label>
          <input
            id="rappel-nom"
            name="nom"
            required
            autoComplete="name"
            className="h-touch rounded-suiton border-mineral-dark focus:border-ocean mt-1.5 w-full border px-3 text-sm transition-colors duration-150 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="rappel-tel" className="block text-sm font-medium">
            Votre numéro
          </label>
          <input
            id="rappel-tel"
            name="telephone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0489 21 01 24"
            className="h-touch rounded-suiton border-mineral-dark tabular focus:border-ocean mt-1.5 w-full border px-3 text-sm transition-colors duration-150 focus:outline-none"
          />
        </div>

        {avecEmail ? (
          <div>
            <label htmlFor="rappel-email" className="block text-sm font-medium">
              Votre e-mail <span className="text-ardoise font-normal">— facultatif</span>
            </label>
            <input
              id="rappel-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.be"
              className="h-touch rounded-suiton border-mineral-dark focus:border-ocean mt-1.5 w-full border px-3 text-sm transition-colors duration-150 focus:outline-none"
            />
          </div>
        ) : null}

        {avecAdresse ? (
          <div>
            <label htmlFor="rappel-adresse" className="block text-sm font-medium">
              Votre adresse <span className="text-ardoise font-normal">— facultatif</span>
            </label>
            <input
              id="rappel-adresse"
              name="adresse"
              autoComplete="street-address"
              placeholder="Rue et numéro, commune"
              className="h-touch rounded-suiton border-mineral-dark focus:border-ocean mt-1.5 w-full border px-3 text-sm transition-colors duration-150 focus:outline-none"
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="rappel-message" className="block text-sm font-medium">
            {libelleMessage} <span className="text-ardoise font-normal">— facultatif</span>
          </label>
          <textarea
            id="rappel-message"
            name="message"
            rows={avecPhotos ? 5 : 3}
            placeholder={placeholderMessage}
            className="rounded-suiton border-mineral-dark focus:border-ocean mt-1.5 w-full border p-3 text-sm transition-colors duration-150 focus:outline-none"
          />
        </div>

        {avecPhotos ? (
          <div>
            <p className="mb-1.5 block text-sm font-medium">
              Ajouter des photos <span className="text-ardoise font-normal">— facultatif</span>
            </p>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              onErreur={setErreur}
              texteAide={aidePhotos}
              texteUsage={usagePhotos}
            />
          </div>
        ) : null}

        {/*
          Champ piege. Cache aux humains par la position, pas par display:none
          — certains robots ignorent les champs invisibles au sens CSS strict.
        */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="rappel-societe">Ne pas remplir</label>
          <input id="rappel-societe" name="societe" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {recap ? (
        <div
          className="rounded-suiton border-aqua-deep/25 bg-aqua-wash mt-5 border px-3.5 py-3 text-sm"
          aria-live="polite"
        >
          <span className="text-ardoise block text-xs">Votre sélection</span>
          <span className="font-medium">{recap}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={etat === 'envoi'}
        className={cn(
          'rounded-suiton bg-abysse text-mineral mt-6 flex h-12 w-full items-center justify-center px-6 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200',
          etat === 'envoi'
            ? 'opacity-60'
            : 'hover:bg-abysse-90 hover:-translate-y-px hover:shadow-md active:translate-y-0',
        )}
      >
        {etat === 'envoi' ? 'Envoi…' : libelleSubmit}
      </button>

      <p aria-live="polite" className="mt-3 min-h-5 text-xs">
        {erreur ? (
          <span className="text-danger">{erreur}</span>
        ) : (
          <span className="text-ardoise">
            Votre numéro sert à vous rappeler. Rien d&apos;autre, jamais de démarchage.
          </span>
        )}
      </p>
    </form>
  );
}
