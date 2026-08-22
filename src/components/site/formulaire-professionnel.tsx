'use client';

import { useState } from 'react';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { cn } from '@/lib/cn';

/**
 * Formulaire de demande professionnelle (page /professionnels).
 *
 * Remplace un simple lien mailto : un bouton qui ouvre le client mail du
 * visiteur est une friction, pas une conversion. Les champs restent ceux
 * qui permettent de repondre avec un chiffre — societe, volume, frequence —
 * sans transformer la demande en formulaire de reservation complet.
 */
export function FormulaireProfessionnel({ id }: { id?: string }) {
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);
  const [besoin, setBesoin] = useState<'annuel' | 'ponctuel'>('annuel');

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    setEtat('envoi');
    setErreur(null);

    try {
      const reponse = await fetch('/api/pro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          societe: String(donnees.get('societe') ?? ''),
          contact: String(donnees.get('contact') ?? ''),
          email: String(donnees.get('email') ?? ''),
          telephone: String(donnees.get('telephone') ?? ''),
          besoin,
          chantiersParMois: String(donnees.get('chantiersParMois') ?? ''),
          surfaceMoyenne: String(donnees.get('surfaceMoyenne') ?? ''),
          frequence: String(donnees.get('frequence') ?? ''),
          zone: String(donnees.get('zone') ?? ''),
          message: String(donnees.get('message') ?? ''),
          honeypot: String(donnees.get('site-web') ?? ''),
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
      <div
        role="status"
        className="rounded-suiton border-aqua-deep/25 bg-aqua-wash mx-auto max-w-2xl border p-6 text-center"
      >
        <h3 className="font-heading text-abysse text-base font-semibold">
          Votre demande a bien été reçue.
        </h3>
        <p className="text-abysse/80 mt-2 text-sm leading-relaxed">
          Nous revenons vers vous sous 24 heures ouvrées. Si c&apos;est urgent, appelez
          directement le{' '}
          <a href={`tel:${ENTREPRISE.telephoneE164}`} className="font-medium underline">
            {ENTREPRISE.telephone}
          </a>
          .
        </p>
      </div>
    );
  }

  const champ =
    'h-touch rounded-suiton border-mineral-dark focus:border-ocean w-full border px-3 text-sm transition-colors duration-150 focus:outline-none';
  const label = 'block text-sm font-medium';

  return (
    <form
      id={id}
      onSubmit={soumettre}
      className="rounded-suiton border-mineral-dark mx-auto max-w-2xl border bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de besoin">
        {(
          [
            { valeur: 'annuel', libelle: 'Grille annuelle' },
            { valeur: 'ponctuel', libelle: 'Devis ponctuel' },
          ] as const
        ).map((b) => (
          <button
            key={b.valeur}
            type="button"
            role="radio"
            aria-checked={besoin === b.valeur}
            onClick={() => setBesoin(b.valeur)}
            className={cn(
              'rounded-suiton flex h-11 items-center justify-center border px-3 text-sm font-medium transition-colors duration-150',
              besoin === b.valeur
                ? 'border-abysse bg-mineral text-abysse'
                : 'border-mineral-dark text-ardoise hover:border-aqua-deep/50',
            )}
          >
            {b.libelle}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pro-societe" className={label}>
            Société
          </label>
          <input
            id="pro-societe"
            name="societe"
            required
            autoComplete="organization"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-contact" className={label}>
            Nom du contact
          </label>
          <input
            id="pro-contact"
            name="contact"
            required
            autoComplete="name"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-email" className={label}>
            Email
          </label>
          <input
            id="pro-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-tel" className={label}>
            Téléphone
          </label>
          <input
            id="pro-tel"
            name="telephone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0489 21 01 24"
            className={cn(champ, 'tabular mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-chantiers" className={label}>
            Chantiers / mois{' '}
            <span className="text-ardoise font-normal">— approximatif</span>
          </label>
          <input
            id="pro-chantiers"
            name="chantiersParMois"
            placeholder="Ex. 3 à 5"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-surface" className={label}>
            Surface moyenne <span className="text-ardoise font-normal">— facultatif</span>
          </label>
          <input
            id="pro-surface"
            name="surfaceMoyenne"
            placeholder="Ex. 90 m²"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-frequence" className={label}>
            Fréquence <span className="text-ardoise font-normal">— facultatif</span>
          </label>
          <input
            id="pro-frequence"
            name="frequence"
            placeholder="Ex. hebdomadaire, par lot livré…"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
        <div>
          <label htmlFor="pro-zone" className={label}>
            Zone d&apos;intervention <span className="text-ardoise font-normal">— facultatif</span>
          </label>
          <input
            id="pro-zone"
            name="zone"
            placeholder="Ex. Enghien, Nivelles…"
            className={cn(champ, 'mt-1.5')}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="pro-message" className={label}>
          Message <span className="text-ardoise font-normal">— facultatif</span>
        </label>
        <textarea
          id="pro-message"
          name="message"
          rows={3}
          placeholder="Contexte du volume, contraintes de planning, communes prioritaires…"
          className="rounded-suiton border-mineral-dark focus:border-ocean mt-1.5 w-full border p-3 text-sm transition-colors duration-150 focus:outline-none"
        />
      </div>

      {/*
        Champ piege. Cache aux humains par la position, pas par display:none
        — certains robots ignorent les champs invisibles au sens CSS strict.
      */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="pro-site-web">Ne pas remplir</label>
        <input id="pro-site-web" name="site-web" tabIndex={-1} autoComplete="off" />
      </div>

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
        {etat === 'envoi'
          ? 'Envoi…'
          : besoin === 'annuel'
            ? 'Demander une grille annuelle'
            : 'Demander un devis ponctuel'}
      </button>

      <p aria-live="polite" className="mt-3 min-h-5 text-center text-xs">
        {etat === 'erreur' && erreur ? (
          <span className="text-danger">{erreur}</span>
        ) : (
          <span className="text-ardoise">Nous revenons vers vous sous 24 heures ouvrées.</span>
        )}
      </p>
    </form>
  );
}
