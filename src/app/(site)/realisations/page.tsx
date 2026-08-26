import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AppelFinal,
  Carte,
  Coche,
  FilAriane,
  ListePuces,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { ENTREPRISE, LANCEMENT } from '@/lib/site/entreprise';
import { realisations } from '@/lib/site/realisations';
import { LIBELLES_SERVICE } from '@/lib/pdf/compose';
import { Jsonld, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

/**
 * Realisations.
 *
 * SUITON ouvre le 1er octobre 2026. Cette page ne montre donc pas encore de
 * chantiers reels — et n'en invente pas. Une galerie de photos achetees en
 * banque d'images sur un site de nettoyage se repere en trois secondes et
 * detruit exactement ce qu'elle pretend construire.
 *
 * Elle montre a la place ce qui est verifiable des aujourd'hui : la forme
 * exacte du rapport que chaque client recevra, et le protocole applique. Des
 * la premiere livraison, les chantiers reels remplaceront cette section.
 */

export const revalidate = 3600;

export const metadata: Metadata = metadonnees({
  title: 'Réalisations et rapports de chantier — SUITON',
  description:
    'Comment nous prouvons le résultat : checklist horodatée poste par poste et photos avant/après au même cadrage, remises à chaque livraison de chantier.',
  chemin: '/realisations',
});

const PROTOCOLE = [
  {
    poste: 'Plafonds, corniches et murs',
    detail: 'Dépoussiérage descendant. Aucun sol n’est lavé avant cette étape.',
  },
  {
    poste: 'Radiateurs, plinthes et menuiseries',
    detail: 'Les rainures et les retours de plinthe se font à la main, pas à l’aspirateur.',
  },
  {
    poste: 'Aspiration — premier passage',
    detail: 'Le gros de la poussière de découpe.',
  },
  {
    poste: 'Vitres, châssis, rainures et joints',
    detail: 'Contrôle en lumière rasante : c’est le seul angle qui révèle les traces.',
  },
  {
    poste: 'Sanitaires et cuisine',
    detail: 'Détartrage, robinetterie, silicone, plans de travail.',
  },
  {
    poste: 'Aspiration — second passage',
    detail:
      'La poussière fine retombe pendant l’intervention. Un seul passage ne suffit jamais.',
  },
  {
    poste: 'Sols et relecture pièce par pièce',
    detail: 'Lavage adapté au revêtement, puis contrôle final, pièce par pièce.',
  },
];

export default async function PageRealisations() {
  const chantiers = await realisations();
  const lancee = Date.now() >= LANCEMENT.getTime();

  return (
    <>
      <Jsonld
        donnees={jsonldFilAriane([
          { nom: 'Accueil', chemin: '/' },
          { nom: 'Réalisations', chemin: '/realisations' },
        ])}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Réalisations', href: '/realisations' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Nous ne nettoyons pas simplement. Nous prouvons le résultat.
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            À la fin de chaque chantier, vous recevez un rapport : la checklist suivie poste par
            poste avec l&apos;heure de chaque étape, et les photos avant/après cadrées au même
            endroit. C&apos;est ce document qui remplace la parole donnée.
          </p>
        </div>
      </section>

      {chantiers.length > 0 ? (
        <Section fond="mineral">
          <TitreSection
            surtitre={`${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''} publié${chantiers.length > 1 ? 's' : ''}`}
            titre="Nos chantiers"
            chapeau="Chaque fiche est un chantier réel, publié avec l'accord du client. Le résumé est écrit à la main, jamais généré."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chantiers.map((c) => {
              const couverture =
                c.paires[0]?.apres ?? c.photos.find((p) => p.phase === 'apres');
              return (
                <li key={c.slug}>
                  <Link
                    href={`/realisations/${c.slug}`}
                    className="group rounded-suiton border-mineral-dark hover:border-ardoise-clair flex h-full flex-col overflow-hidden border bg-white transition-colors"
                  >
                    {couverture ? (
                      <img
                        src={couverture.miniature ?? couverture.url}
                        alt={`${LIBELLES_SERVICE[c.service]} à ${c.commune}`}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="bg-mineral text-ardoise flex aspect-[4/3] w-full items-center justify-center text-xs">
                        Rapport sans photo publiée
                      </span>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-aqua-deep text-xs font-medium tracking-[0.1em] uppercase">
                        {c.commune} · {c.surface} m²
                      </p>
                      <h3 className="font-heading group-hover:text-ocean mt-2 text-base font-semibold">
                        {LIBELLES_SERVICE[c.service]}
                      </h3>
                      <p className="text-ardoise mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
                        {c.resume}
                      </p>
                      <p className="border-mineral-dark text-ardoise mt-4 border-t pt-3 text-xs">
                        {c.paires.length > 0
                          ? `${c.paires.length} comparaison${c.paires.length > 1 ? 's' : ''} avant/après`
                          : 'Rapport de chantier'}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {chantiers.length === 0 && !lancee ? (
        <Section fond="mineral">
          <Carte className="mx-auto max-w-3xl">
            <h2 className="font-heading text-lg font-semibold">
              Nos premiers chantiers seront publiés dès octobre 2026
            </h2>
            <p className="text-ardoise mt-4 text-sm leading-relaxed">
              SUITON ouvre le 1<sup>er</sup> octobre 2026. Nous préférons une page vide à une
              galerie d&apos;images achetées : vous ne pourriez pas savoir lesquelles sont les
              nôtres, et c&apos;est précisément le problème que ce métier doit résoudre.
            </p>
            <p className="text-ardoise mt-4 text-sm leading-relaxed">
              En attendant, voici ce qui est vérifiable dès aujourd&apos;hui : la forme exacte
              du rapport que vous recevrez, et le protocole que nous appliquons. Les deux
              figurent déjà sur nos devis.
            </p>
            <p className="border-mineral-dark mt-6 border-t pt-4 text-sm">
              Vous voulez être parmi les premiers chantiers ?{' '}
              <Link href="/reservation" className="text-ocean underline">
                Demandez un devis
              </Link>{' '}
              ou appelez le{' '}
              <a href={`tel:${ENTREPRISE.telephoneE164}`} className="text-ocean underline">
                {ENTREPRISE.telephone}
              </a>
              .
            </p>
          </Carte>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {['Fin de travaux', 'Vitres & châssis'].map((categorie) => (
              <li
                key={categorie}
                className="rounded-suiton border-mineral-dark flex h-full flex-col overflow-hidden border bg-white"
              >
                <span className="border-mineral-dark text-ardoise-clair flex aspect-[4/3] w-full items-center justify-center border-b text-xs">
                  Photo à venir
                </span>
                <p className="px-5 py-4 text-sm font-medium">{categorie}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Le rapport ------------------------------------------------------ */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection
              surtitre="Le rapport de chantier"
              titre="Ce que vous recevez, à chaque livraison"
            />
            <div className="mt-8">
              <ListePuces
                items={[
                  'Checklist horodatée : chaque ligne est cochée sur le terrain, au moment où le poste est fait — pas reconstituée le soir',
                  'Photos avant/après au même cadrage, pièce par pièce',
                  'Réserves éventuelles consignées, avec photo — nous signalons ce que nous n’avons pas pu traiter',
                  'Durée réelle de l’intervention, du début à la fin',
                  'PDF conservé et consultable à tout moment dans votre espace client',
                ]}
              />
            </div>
            <p className="text-ardoise mt-8 text-sm leading-relaxed">
              Ce rapport est neutre : il constate, il ne vend rien. C&apos;est ce qui le rend
              transmissible tel quel à un client final ou annexable à un PV de réception.
            </p>
          </div>

          <Carte className="bg-mineral">
            <p className="text-ardoise text-xs font-medium tracking-[0.12em] uppercase">
              Rapport de chantier — extrait
            </p>
            <dl className="divide-mineral-dark mt-5 divide-y">
              {[
                ['Plafonds et corniches', '08:40'],
                ['Radiateurs et plinthes', '09:15'],
                ['Aspiration — passage 1', '09:52'],
                ['Vitres, châssis et joints', '10:34'],
                ['Sanitaires et cuisine', '11:20'],
                ['Aspiration — passage 2', '12:05'],
                ['Sols et relecture', '12:48'],
              ].map(([poste, heure]) => (
                <div key={poste} className="flex items-center gap-3 py-3">
                  <Coche className="text-aqua-deep" />
                  <dt className="flex-1 text-sm">{poste}</dt>
                  <dd className="tabular text-ardoise text-xs">{heure}</dd>
                </div>
              ))}
            </dl>
            <p className="border-mineral-dark text-ardoise mt-5 border-t pt-4 text-xs leading-relaxed">
              Exemple de séquence sur une maison de 140 m², salissure standard. Les heures
              réelles varient ; leur enregistrement, non.
            </p>
          </Carte>
        </div>
      </Section>

      {/* Protocole ------------------------------------------------------- */}
      <Section fond="abysse">
        <TitreSection
          surtitre="Le protocole"
          titre="Sept postes, toujours dans le même ordre"
          chapeau="L'ordre n'est pas une préférence : nettoyer les sols avant d'avoir dépoussiéré les corniches revient à les nettoyer deux fois. C'est aussi ce qui rend le résultat reproductible d'un chantier à l'autre."
          inverse
        />
        <ol className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {PROTOCOLE.map((p, i) => (
            <li key={p.poste} className="flex gap-6 py-5">
              <span className="font-heading tabular text-aqua w-8 shrink-0 text-sm font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-heading text-mineral text-base font-medium">{p.poste}</h3>
                <p className="text-mineral/60 mt-1 text-sm leading-relaxed">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <AppelFinal />
    </>
  );
}
