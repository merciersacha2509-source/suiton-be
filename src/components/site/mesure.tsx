'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Mesure d'audience.
 *
 * DEUX DISPOSITIFS, DELIBEREMENT DIFFERENTS.
 *
 * 1. Vercel Web Analytics et Speed Insights, actifs par defaut.
 *    Sans cookie, sans identifiant persistant, servis depuis le domaine
 *    (`/_vercel/insights`). Aucun consentement prealable n'est requis pour
 *    une mesure d'audience anonyme de ce type, donc aucune banniere : et une
 *    banniere sur une page de vente coute des demandes de devis.
 *    Speed Insights remonte les Core Web Vitals REELS des visiteurs — c'est
 *    la seule mesure de LCP, CLS et INP qui vaille, celle du terrain.
 *
 * 2. Google Analytics, inactif tant que NEXT_PUBLIC_GA_ID n'est pas defini.
 *    GA depose des cookies et transfere des donnees hors UE : il exige un
 *    consentement prealable, libre et revocable. Le script n'est donc charge
 *    QU'APRES un consentement explicite, jamais avant. Le mode « refuser »
 *    est aussi accessible que le mode « accepter » — un banniere ou seul
 *    « accepter » est visible n'est pas un consentement valide.
 *
 * Recommandation : rester sur le dispositif 1. GA n'apporte, pour ce site,
 * presque rien que Vercel Analytics ne donne deja, et coute une banniere.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CLE_CONSENTEMENT = 'suiton.consentement.mesure';

export function Mesure() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
      {GA_ID ? <GoogleAnalytics id={GA_ID} /> : null}
    </>
  );
}

function GoogleAnalytics({ id }: { id: string }) {
  const [choix, setChoix] = useState<'inconnu' | 'accepte' | 'refuse'>('inconnu');

  useEffect(() => {
    // Le consentement est conserve dans le navigateur, pas cote serveur :
    // c'est une preference locale, pas une donnee a collecter.
    try {
      const memorise = window.localStorage.getItem(CLE_CONSENTEMENT);
      if (memorise === 'accepte' || memorise === 'refuse') setChoix(memorise);
    } catch {
      /* navigation privee : on redemandera */
    }
  }, []);

  const decider = (valeur: 'accepte' | 'refuse') => {
    setChoix(valeur);
    try {
      window.localStorage.setItem(CLE_CONSENTEMENT, valeur);
    } catch {
      /* sans importance */
    }
  };

  return (
    <>
      {choix === 'accepte' ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {choix === 'inconnu' ? (
        <div
          role="dialog"
          aria-label="Mesure d’audience"
          className="border-mineral-dark fixed inset-x-0 bottom-16 z-50 border-t bg-white p-4 shadow-lg lg:bottom-0"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm leading-relaxed">
              Nous aimerions mesurer l&apos;audience du site avec Google Analytics, qui dépose
              des cookies. Le site fonctionne à l&apos;identique si vous refusez.{' '}
              <Link href="/confidentialite" className="underline">
                En savoir plus
              </Link>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => decider('refuse')}
                className="h-touch rounded-suiton border-mineral-dark flex-1 border px-4 text-sm font-medium sm:flex-none"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={() => decider('accepte')}
                className="h-touch rounded-suiton bg-abysse text-mineral flex-1 px-4 text-sm font-medium sm:flex-none"
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
