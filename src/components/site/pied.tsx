import Link from 'next/link';
import { SuitonLogo } from '@/components/brand/suiton-mark';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { COMMUNES } from '@/lib/site/communes';

/**
 * Pied de page.
 *
 * Il porte le maillage interne : chaque service et chaque commune y sont
 * lies depuis toutes les pages. C'est la structure la moins spectaculaire
 * du site et l'une des plus determinantes pour l'indexation.
 *
 * La liste de services est volontairement la hierarchie a quatre prestations
 * (fin de travaux, vitres, puis textile/auto en complementaire) et non le
 * tableau complet `SERVICES` — celui-ci inclut des variantes par type de
 * bien (appartement, maison) qui n'ont pas leur place dans une liste
 * presentee comme "nos services".
 */
const SERVICES_PIED = [
  { slug: 'nettoyage-fin-de-chantier', nom: 'Nettoyage de fin de travaux' },
  { slug: 'nettoyage-de-vitres', nom: 'Nettoyage de vitres' },
  { slug: 'nettoyage-textile', nom: 'Nettoyage textile' },
  { slug: 'nettoyage-auto', nom: 'Nettoyage automobile' },
];
export function Pied() {
  return (
    <footer className="bg-abysse text-mineral border-aqua-deep/60 border-t-2">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <SuitonLogo inverse />
            <p className="text-mineral/70 mt-4 max-w-xs text-sm">{ENTREPRISE.slogan}</p>
            <address className="text-mineral/70 mt-6 space-y-1 text-sm not-italic">
              <div>{ENTREPRISE.adresse}</div>
              <div>
                {ENTREPRISE.codePostal} {ENTREPRISE.commune}
              </div>
              <div className="pt-2">
                <a
                  href={`tel:${ENTREPRISE.telephoneE164}`}
                  className="hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  {ENTREPRISE.telephone}
                </a>
              </div>
              <div>
                <a
                  href={`mailto:${ENTREPRISE.email}`}
                  className="hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  {ENTREPRISE.email}
                </a>
              </div>
            </address>
          </div>

          <nav aria-label="Services">
            <h2 className="font-heading text-mineral/50 inline-flex items-center gap-1.5 text-xs tracking-[0.12em] uppercase">
              <span className="bg-aqua h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Services
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {SERVICES_PIED.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                  >
                    {s.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Zones desservies">
            <h2 className="font-heading text-mineral/50 inline-flex items-center gap-1.5 text-xs tracking-[0.12em] uppercase">
              <span className="bg-aqua h-1 w-1 shrink-0 rounded-full" aria-hidden />
              Zones desservies
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {COMMUNES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/nettoyage-fin-de-chantier/${c.slug}`}
                    className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                  >
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Entreprise">
            <h2 className="font-heading text-mineral/50 inline-flex items-center gap-1.5 text-xs tracking-[0.12em] uppercase">
              <span className="bg-aqua h-1 w-1 shrink-0 rounded-full" aria-hidden />
              SUITON
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/realisations"
                  className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Réalisations
                </Link>
              </li>
              <li>
                <Link
                  href="/professionnels"
                  className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Professionnels
                </Link>
              </li>
              <li>
                <Link
                  href="/a-propos"
                  className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  À propos
                </Link>
              </li>
              <li>
                <Link
                  href="/devis"
                  className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Devis gratuit
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-mineral/80 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Contact
                </Link>
              </li>
              <li className="pt-3">
                <Link
                  href="/mentions-legales"
                  className="text-mineral/60 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link
                  href="/confidentialite"
                  className="text-mineral/60 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link
                  href="/conditions-generales"
                  className="text-mineral/60 hover:text-aqua inline-block transition-[color,transform] duration-150 hover:translate-x-0.5"
                >
                  Conditions générales
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="text-mineral/50 mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">
            © {new Date().getFullYear()} SUITON — TVA {ENTREPRISE.tva} — Peppol{' '}
            {ENTREPRISE.peppol}
          </p>
          <p>Enghien · Brabant wallon · Hainaut · Bruxelles</p>
        </div>
      </div>
    </footer>
  );
}
