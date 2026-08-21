import Link from 'next/link';
import { Calculateur } from '@/components/site/calculateur';
import {
  AppelFinal,
  Carte,
  Faq,
  FilAriane,
  ListePuces,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { Jsonld, jsonldFaq, jsonldFilAriane, jsonldService } from '@/lib/site/seo';
import { GARANTIES } from '@/lib/site/entreprise';
import { parSlug, type Service } from '@/lib/site/services';
import { COMMUNES } from '@/lib/site/communes';
import type { GrillePublique } from '@/lib/pricing';

/**
 * Gabarit des pages de service.
 *
 * Le gabarit est commun, le contenu ne l'est pas : tout ce qui apparait ici
 * vient de `SERVICES`, ou chaque service a ete redige separement. Une page
 * de service qui ne differe des autres que par un nom substitue ne se
 * positionne pas — Google reconnait le remplissage de gabarit depuis
 * longtemps.
 */
export function PageService({
  service,
  settings,
}: {
  service: Service;
  settings: GrillePublique;
}) {
  const connexes = service.connexes.map(parSlug).filter((s): s is Service => Boolean(s));

  return (
    <>
      <Jsonld
        donnees={[
          jsonldService({
            nom: service.nom,
            description: service.metaDescription,
            chemin: `/${service.slug}`,
            prixDepuis: service.prixDepuis,
            communes: COMMUNES,
          }),
          jsonldFaq(service.faq),
          jsonldFilAriane([
            { nom: 'Accueil', chemin: '/' },
            { nom: service.nom, chemin: `/${service.slug}` },
          ]),
        ]}
      />

      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: service.nom, href: `/${service.slug}` },
        ]}
      />

      {/* Premier ecran ------------------------------------------------- */}
      <section className="border-mineral-dark border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 lg:grid-cols-[1fr_24rem] lg:gap-14">
          <div>
            <h1 className="max-w-2xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
              {service.h1}
            </h1>
            <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              {service.accroche}
            </p>

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">À partir de</dt>
                <dd className="font-heading tabular mt-1 text-2xl font-semibold">
                  {service.prixDepuis} € <span className="text-sm font-normal">/ m² HTVA</span>
                </dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Durée type</dt>
                <dd className="font-heading mt-1 text-base font-medium">{service.dureeType}</dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Devis</dt>
                <dd className="font-heading mt-1 text-base font-medium">Ferme, sous 24 h</dd>
              </div>
            </dl>

            <div className="rounded-suiton border-aqua bg-mineral mt-8 max-w-2xl border-l-2 p-5">
              <h2 className="font-heading text-ardoise text-sm font-semibold tracking-[0.1em] uppercase">
                Le problème
              </h2>
              <p className="mt-3 text-sm leading-relaxed">{service.probleme}</p>
            </div>
          </div>

          <div className="lg:pt-2">
            <Calculateur
              settings={settings}
              serviceInitial={service.type ?? 'fin_de_chantier'}
              compact
            />
          </div>
        </div>
      </section>

      {/* Inclus / exclus ----------------------------------------------- */}
      <Section fond="mineral">
        <TitreSection
          surtitre="Le périmètre"
          titre="Ce qui est compris, et ce qui ne l'est pas"
          chapeau="Une colonne de droite vide est un devis qui finira en litige. Nous préférons annoncer les limites avant l'intervention."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Carte>
            <h3 className="font-heading text-base font-semibold">Compris dans le prix</h3>
            <div className="mt-5">
              <ListePuces items={service.inclus} />
            </div>
          </Carte>
          <Carte>
            <h3 className="font-heading text-base font-semibold">Non compris</h3>
            <div className="mt-5">
              <ListePuces items={service.exclus} ton="negatif" />
            </div>
            <p className="border-mineral-dark text-ardoise mt-5 border-t pt-4 text-xs leading-relaxed">
              Ces prestations restent possibles : elles font l&apos;objet d&apos;une ligne
              séparée sur le devis, chiffrée à l&apos;avance.
            </p>
          </Carte>
        </div>
      </Section>

      {/* Deroulement ---------------------------------------------------- */}
      <Section>
        <TitreSection
          surtitre="Notre méthode"
          titre="L'ordre des opérations n'est pas négociable"
          chapeau="Nettoyer les sols avant d'avoir dépoussiéré les corniches revient à les nettoyer deux fois. Le protocole est le même sur chaque chantier — c'est ce qui rend le résultat reproductible."
        />
        <ol className="rounded-suiton border-mineral-dark bg-mineral-dark mt-10 grid gap-px overflow-hidden border sm:grid-cols-2 lg:grid-cols-3">
          {service.deroulement.map((e, i) => (
            <li key={e.titre} className="bg-white p-6">
              <span className="font-heading tabular text-aqua-deep text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-base font-semibold">{e.titre}</h3>
              <p className="text-ardoise mt-2 text-sm leading-relaxed">{e.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Garanties ------------------------------------------------------ */}
      <Section fond="abysse">
        <TitreSection
          surtitre="Nos engagements"
          titre="Quatre promesses écrites sur le devis"
          inverse
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GARANTIES.map((g) => (
            <div key={g.titre}>
              <span className="bg-aqua block h-px w-8" aria-hidden />
              <h3 className="font-heading text-mineral mt-4 text-base font-semibold">
                {g.titre}
              </h3>
              <p className="text-mineral/60 mt-2 text-sm leading-relaxed">{g.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ ------------------------------------------------------------ */}
      <Section>
        <Faq items={service.faq} titre={`${service.nom} : vos questions`} />
      </Section>

      {/* Maillage ------------------------------------------------------- */}
      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {connexes.length > 0 ? (
            <div>
              <h2 className="font-heading text-lg font-semibold">Prestations liées</h2>
              <ul className="mt-5 space-y-3">
                {connexes.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/${s.slug}`}
                      className="group border-mineral-dark flex items-baseline justify-between gap-4 border-b pb-3"
                    >
                      <span className="group-hover:text-ocean text-sm font-medium">
                        {s.nom}
                      </span>
                      <span className="text-ardoise shrink-0 text-xs">
                        dès {s.prixDepuis} €/m²
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h2 className="font-heading text-lg font-semibold">Où nous intervenons</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {COMMUNES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/nettoyage-fin-de-chantier/${c.slug}`}
                    className="rounded-suiton border-mineral-dark hover:border-ardoise-clair inline-flex h-9 items-center border bg-white px-3 text-sm transition-colors"
                  >
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <AppelFinal titre={`Besoin d'un ${service.nom.toLowerCase()} ?`} />
    </>
  );
}
