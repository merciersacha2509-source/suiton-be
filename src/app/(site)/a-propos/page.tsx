import type { Metadata } from 'next';
import {
  AppelFinal,
  Carte,
  FilAriane,
  ListePuces,
  Section,
  TitreSection,
} from '@/components/site/blocs';
import { ENTREPRISE, GARANTIES } from '@/lib/site/entreprise';
import { Jsonld, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: 'À propos de SUITON — nettoyage de fin de chantier à Enghien',
  description:
    'SUITON est une entreprise de nettoyage de fin de chantier basée à Enghien. Notre méthode, nos engagements, et pourquoi nous documentons chaque intervention.',
  chemin: '/a-propos',
});

export default function PageAPropos() {
  return (
    <>
      <Jsonld
        donnees={jsonldFilAriane([
          { nom: 'Accueil', chemin: '/' },
          { nom: 'À propos', chemin: '/a-propos' },
        ])}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'À propos', href: '/a-propos' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Une entreprise de nettoyage qui documente son travail
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            {ENTREPRISE.slogan}
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div className="text-ardoise max-w-2xl space-y-5 text-base leading-relaxed">
            <p>
              SUITON est née d&apos;un constat simple : dans le nettoyage de fin de chantier, le
              client ne peut presque jamais vérifier ce qu&apos;il a acheté. Il arrive après,
              dans un bien vide, et il juge une impression. Si quelque chose a été oublié
              derrière un radiateur ou dans une rainure de châssis, il le découvrira trois
              semaines plus tard — quand il sera trop tard pour en parler.
            </p>
            <p>
              Ce déséquilibre produit toujours le même effet : le prix devient le seul critère
              de choix, parce que c&apos;est la seule chose comparable. Et une profession où
              seul le prix compte finit par livrer ce que le prix permet.
            </p>
            <p>
              Nous avons construit l&apos;entreprise dans l&apos;autre sens. Chaque chantier est
              exécuté selon un protocole écrit, dans un ordre qui ne change pas, et chaque poste
              est coché sur le terrain au moment où il est fait. À la fin, le client reçoit ce
              relevé, horodaté, avec les photos avant/après. Il n&apos;a pas à nous croire.
            </p>
            <p>
              C&apos;est aussi ce qui nous permet d&apos;être fermes sur nos devis : quand on
              mesure le temps réel de chaque intervention, on sait ce que coûte un chantier. On
              n&apos;a plus besoin de se protéger par une fourchette large.
            </p>
          </div>

          <Carte className="bg-mineral h-fit">
            <h2 className="font-heading text-base font-semibold">L&apos;entreprise</h2>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['Dénomination', ENTREPRISE.nom],
                ['Activité', ENTREPRISE.activite],
                [
                  'Siège',
                  `${ENTREPRISE.adresse}, ${ENTREPRISE.codePostal} ${ENTREPRISE.commune}`,
                ],
                ['TVA', ENTREPRISE.tva],
                ['Peppol', ENTREPRISE.peppol],
                ['Téléphone', ENTREPRISE.telephone],
                ['Courriel', ENTREPRISE.email],
                ['Rayon', `${ENTREPRISE.rayonKm} km autour d’Enghien`],
              ].map(([cle, valeur]) => (
                <div
                  key={cle}
                  className="border-mineral-dark flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-3 last:border-0"
                >
                  <dt className="text-ardoise">{cle}</dt>
                  <dd className="text-right font-medium">{valeur}</dd>
                </div>
              ))}
            </dl>
            <h3 className="font-heading mt-8 text-base font-semibold">Horaires</h3>
            <dl className="mt-4 space-y-2 text-sm">
              {ENTREPRISE.horaires.map((h) => (
                <div key={h.jours} className="flex justify-between gap-4">
                  <dt className="text-ardoise">{h.jours}</dt>
                  <dd className="font-medium">{h.heures}</dd>
                </div>
              ))}
            </dl>
          </Carte>
        </div>
      </Section>

      <Section fond="mineral">
        <TitreSection
          surtitre="Nos engagements"
          titre="Ce à quoi nous nous tenons"
          chapeau="Ces quatre points figurent sur chaque devis SUITON. Une promesse qui n'existe que sur un site n'engage personne."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {GARANTIES.map((g) => (
            <Carte key={g.titre} className="bg-white">
              <h3 className="font-heading text-base font-semibold">{g.titre}</h3>
              <p className="text-ardoise mt-3 text-sm leading-relaxed">{g.detail}</p>
            </Carte>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection
              surtitre="Ce que nous ne faisons pas"
              titre="Dire non fait partie du métier"
            />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Nous refusons régulièrement des chantiers. Pas par confort : parce
              qu&apos;accepter un travail qu&apos;on ne sait pas bien faire finit toujours par
              coûter plus cher au client qu&apos;un refus honnête.
            </p>
          </div>
          <div>
            <ListePuces
              ton="negatif"
              items={[
                'Évacuation de gravats et débarras — nous nettoyons, nous ne vidons pas',
                'Travaux en hauteur nécessitant nacelle ou échafaudage',
                'Décapage industriel à la monobrosse',
                'Traitement de moisissures ou suites de dégâts des eaux',
                'Nettoyage après sinistre ou insalubrité lourde',
              ]}
            />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Dans ces cas, nous vous orientons vers une entreprise dont c&apos;est le métier.
              Nous n&apos;en tirons rien — c&apos;est simplement la bonne réponse.
            </p>
          </div>
        </div>
      </Section>

      <AppelFinal />
    </>
  );
}
