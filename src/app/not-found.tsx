import Link from 'next/link';
import { SuitonMark } from '@/components/brand/suiton-mark';
import { SERVICES } from '@/lib/site/services';
import { ENTREPRISE } from '@/lib/site/entreprise';

/**
 * 404.
 *
 * Une page introuvable sur un site commercial est un visiteur en train de
 * partir. Plutot qu'un cul-de-sac, on lui redonne les trois chemins qui
 * comptent : les prestations, le devis, le telephone.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <SuitonMark size={40} />

      <div>
        <p className="font-heading text-ardoise text-sm font-medium tracking-[0.14em]">
          ERREUR 404
        </p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Cette page n&apos;existe pas
        </h1>
        <p className="text-ardoise mt-3 text-sm leading-relaxed">
          Le lien est peut-être ancien, ou comporte une faute. Voici ce que vous cherchiez
          probablement.
        </p>
      </div>

      <nav aria-label="Pages principales">
        <ul className="divide-mineral-dark border-mineral-dark divide-y border-y">
          {SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/${s.slug}`}
                className="group flex items-baseline justify-between gap-4 py-3.5"
              >
                <span className="group-hover:text-ocean text-sm font-medium">{s.nom}</span>
                <span className="text-ardoise shrink-0 text-xs">
                  {s.slug === 'nettoyage-de-vitres' ? 'Sur devis' : `dès ${s.prixDepuis} €/m²`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/reservation"
          className="rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 flex h-12 items-center justify-center px-6 text-sm font-medium transition-colors"
        >
          Demander un devis
        </Link>
        <a
          href={`tel:${ENTREPRISE.telephoneE164}`}
          className="rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-12 items-center justify-center border px-6 text-sm font-medium transition-colors"
        >
          {ENTREPRISE.telephone}
        </a>
        <Link
          href="/"
          className="text-ardoise hover:text-abysse flex h-12 items-center justify-center px-4 text-sm"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
