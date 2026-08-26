import Link from 'next/link';
import { Calculateur } from '@/components/site/calculateur';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { SuitonMark } from '@/components/brand/suiton-mark';
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

/*
 * Les vitres seules n'ont plus de prix automatique : l'accessibilite, le
 * nombre de faces et l'etat des chassis pesent trop pour qu'une fourchette
 * en ligne reste honnete. Cette page bascule donc sur une demande de visite
 * avec photos plutot que sur le simulateur.
 */
const SUR_DEVIS_APRES_VISITE = 'nettoyage-de-vitres';

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
  const surDevisApresVisite = service.slug === SUR_DEVIS_APRES_VISITE;

  return (
    <>
      <Jsonld
        donnees={[
          jsonldService({
            nom: service.nom,
            description: service.metaDescription,
            chemin: `/${service.slug}`,
            prixDepuis: surDevisApresVisite ? undefined : service.prixDepuis,
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
      <section className="border-mineral-dark relative overflow-hidden border-b">
        <SuitonMark
          size={560}
          className="pointer-events-none absolute -top-20 -right-36 hidden opacity-[0.07] lg:block"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 lg:grid-cols-[1fr_24rem] lg:gap-14">
          <div>
            <h1 className="max-w-2xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
              {service.h1}
            </h1>
            <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              {service.accroche}
            </p>

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Prix</dt>
                <dd className="font-heading tabular mt-1 text-2xl font-semibold">
                  {surDevisApresVisite ? (
                    'Sur devis après visite'
                  ) : (
                    <>
                      {service.prixDepuis} €{' '}
                      <span className="text-sm font-normal">/ m² HTVA</span>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Durée type</dt>
                <dd className="font-heading mt-1 text-base font-medium">{service.dureeType}</dd>
              </div>
              <div>
                <dt className="text-ardoise text-xs tracking-[0.1em] uppercase">Devis</dt>
                <dd className="font-heading mt-1 text-base font-medium">
                  {surDevisApresVisite ? 'Après visite sur place' : 'Ferme, sous 24 h'}
                </dd>
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
            {surDevisApresVisite ? (
              <FormulaireRappel
                id="devis-vitres"
                titre="Demander une visite"
                description="Le prix dépend de l'accessibilité, du nombre de faces et de l'état des châssis : nous préférons voir avant de chiffrer."
                libelleMessage="Décrivez votre besoin"
                placeholderMessage="Type de bien, nombre de fenêtres approximatif, accessibilité, hauteur, état des châssis…"
                libelleSubmit="Demander mon devis"
                avecPhotos
              />
            ) : (
              <Calculateur settings={settings} compact />
            )}
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
            <li
              key={e.titre}
              className="hover:bg-mineral bg-white p-6 transition-colors duration-200"
            >
              <span className="font-heading tabular text-aqua-deep text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-base font-semibold">{e.titre}</h3>
              <p className="text-ardoise mt-2 text-sm leading-relaxed">{e.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Controle qualite ------------------------------------------------ */}
      <Section fond="mineral">
        <TitreSection
          surtitre="Contrôle qualité"
          titre="Chaque chantier est contrôlé avant livraison"
          chapeau="Vous ne devez pas envoyer quelqu'un derrière nous pour vérifier. Le contrôle fait partie de l'intervention, pas de l'après-vente."
        />
        <ol className="mt-10 grid gap-px sm:grid-cols-3 lg:grid-cols-6">
          {[
            { titre: 'Préparation', detail: 'Repérage des zones sensibles et protection.' },
            { titre: 'Nettoyage', detail: 'Sept postes, toujours dans le même ordre.' },
            { titre: 'Contrôle pièce par pièce', detail: 'Relecture, pas un coup d’œil global.' },
            {
              titre: 'Vitrages et châssis',
              detail: 'Vérifiés en lumière rasante, seul angle révélateur.',
            },
            { titre: 'Photos avant/après', detail: 'Même cadrage, horodatées sur place.' },
            { titre: 'Livraison', detail: 'Rapport remis, réserves consignées s’il y en a.' },
          ].map((e, i) => (
            <li key={e.titre} className="border-mineral-dark border bg-white p-5">
              <span className="font-heading tabular text-aqua-deep text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-sm font-semibold">{e.titre}</h3>
              <p className="text-ardoise mt-1.5 text-xs leading-relaxed">{e.detail}</p>
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
                      className="group border-mineral-dark hover:border-aqua-deep/50 flex items-baseline justify-between gap-4 border-b pb-3 transition-colors duration-200"
                    >
                      <span className="group-hover:text-ocean text-sm font-medium transition-colors duration-200">
                        {s.nom}
                      </span>
                      <span className="text-ardoise shrink-0 text-xs">
                        {s.slug === SUR_DEVIS_APRES_VISITE
                          ? 'Sur devis'
                          : `dès ${s.prixDepuis} €/m²`}
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
                    className="rounded-suiton border-mineral-dark hover:border-ardoise-clair inline-flex h-9 items-center border bg-white px-3 text-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
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
