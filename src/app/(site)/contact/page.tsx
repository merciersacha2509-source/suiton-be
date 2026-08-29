import type { Metadata } from 'next';
import Link from 'next/link';
import { AppelFinal, Carte, FilAriane, Section, TitreSection } from '@/components/site/blocs';
import { FormulaireRappel } from '@/components/site/formulaire-rappel';
import { CarteZone } from '@/components/site/carte-zone';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { COMMUNES } from '@/lib/site/communes';
import { Jsonld, jsonldFilAriane, metadonnees } from '@/lib/site/seo';

/**
 * Contact.
 *
 * Pas de formulaire generique. Le parcours /reservation est deja le
 * formulaire du site, et il est bien meilleur : il collecte ce dont nous
 * avons besoin pour chiffrer. Un second formulaire « ecrivez-nous » ne ferait
 * que produire des messages auxquels il faut repondre en demandant les memes
 * informations.
 *
 * Cette page donne donc les canaux directs, et oriente vers le parcours.
 */

export const revalidate = 86400;

export const metadata: Metadata = metadonnees({
  title: 'Contact — SUITON, nettoyage de fin de travaux à Enghien',
  description: `Contactez SUITON au ${ENTREPRISE.telephone} ou par courriel. Basés à Enghien, nous intervenons dans un rayon de ${ENTREPRISE.rayonKm} km : Hal, Tubize, Nivelles, Waterloo, Bruxelles.`,
  chemin: '/contact',
});

export default function PageContact() {
  return (
    <>
      <Jsonld
        donnees={jsonldFilAriane([
          { nom: 'Accueil', chemin: '/' },
          { nom: 'Contact', chemin: '/contact' },
        ])}
      />
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Contact', href: '/contact' },
        ]}
      />

      <section className="border-mineral-dark border-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <h1 className="max-w-3xl text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Nous joindre
          </h1>
          <p className="text-ardoise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Le téléphone reste le plus rapide, surtout pour une date serrée. Pour un devis, le
            parcours en ligne est plus efficace : il collecte d&apos;emblée ce dont nous avons
            besoin pour chiffrer.
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          <Carte>
            <h2 className="font-heading text-base font-semibold">Par téléphone</h2>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Du lundi au vendredi de 8 h à 17 h, le samedi de 8 h à 13 h. Si nous sommes sur un
              chantier, laissez un message : nous rappelons le jour même.
            </p>
            <a
              href={`tel:${ENTREPRISE.telephoneE164}`}
              className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 mt-5 flex items-center justify-center px-4 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
            >
              {ENTREPRISE.telephone}
            </a>
          </Carte>

          <Carte>
            <h2 className="font-heading text-base font-semibold">Par WhatsApp</h2>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Pratique pour envoyer des photos du chantier. Quelques images valent souvent mieux
              qu&apos;une longue description — et permettent un chiffrage plus juste.
            </p>
            <a
              href={`https://wa.me/${ENTREPRISE.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-touch rounded-suiton border-mineral-dark hover:border-ardoise-clair mt-5 flex items-center justify-center border px-4 text-sm font-medium transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
            >
              Ouvrir WhatsApp
            </a>
          </Carte>

          <Carte>
            <h2 className="font-heading text-base font-semibold">Par courriel</h2>
            <p className="text-ardoise mt-3 text-sm leading-relaxed">
              Pour les demandes professionnelles, les grilles annuelles et tout ce qui demande
              une trace écrite. Réponse sous un jour ouvré.
            </p>
            <a
              href={`mailto:${ENTREPRISE.email}`}
              className="h-touch rounded-suiton border-mineral-dark hover:border-ardoise-clair mt-5 flex items-center justify-center border px-4 text-sm font-medium transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm active:translate-y-0"
            >
              {ENTREPRISE.email}
            </a>
          </Carte>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <FormulaireRappel />

          <div className="rounded-suiton border-aqua-deep/25 bg-aqua-wash border p-6">
            <h2 className="font-heading text-base font-semibold">Vous voulez un prix ?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed">
              Le parcours en ligne prend deux minutes, affiche une estimation pendant que vous
              le remplissez, et déclenche un devis ferme sous 24 heures ouvrées. C&apos;est plus
              rapide qu&apos;un échange de courriels, et vous savez tout de suite dans quel
              ordre de grandeur vous êtes.
            </p>
            <Link
              href="/reservation"
              className="h-touch rounded-suiton bg-abysse text-mineral hover:bg-abysse-90 mt-5 inline-flex items-center px-5 text-sm font-medium shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0"
            >
              Démarrer ma demande de devis
            </Link>

            <dl className="border-aqua-deep/20 mt-8 space-y-3 border-t pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Estimation affichée</dt>
                <dd className="font-medium">immédiate</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Devis ferme</dt>
                <dd className="font-medium">sous 24 h ouvrées</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Engagement</dt>
                <dd className="font-medium">aucun</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section fond="mineral">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <TitreSection titre="Adresse et horaires" niveau={2} />
            <address className="mt-6 space-y-1 text-base not-italic">
              <div className="font-medium">{ENTREPRISE.nom}</div>
              <div>{ENTREPRISE.adresse}</div>
              <div>
                {ENTREPRISE.codePostal} {ENTREPRISE.commune}, {ENTREPRISE.paysNom}
              </div>
            </address>
            <p className="text-ardoise mt-4 text-sm">
              Siège administratif. Nous n&apos;avons pas de comptoir : nous travaillons chez
              vous.
            </p>
            <dl className="border-mineral-dark mt-8 max-w-sm space-y-2 border-t pt-5 text-sm">
              {ENTREPRISE.horaires.map((h) => (
                <div key={h.jours} className="flex justify-between gap-4">
                  <dt className="text-ardoise">{h.jours}</dt>
                  <dd className="font-medium">{h.heures}</dd>
                </div>
              ))}
            </dl>
            <dl className="border-mineral-dark mt-8 max-w-sm space-y-2 border-t pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">TVA</dt>
                <dd className="tabular font-medium">{ENTREPRISE.tva}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ardoise">Peppol</dt>
                <dd className="tabular font-medium">{ENTREPRISE.peppol}</dd>
              </div>
            </dl>
          </div>

          <div>
            <TitreSection titre="Zone d'intervention" niveau={2} />
            <p className="text-ardoise mt-6 text-sm leading-relaxed">
              Rayon de {ENTREPRISE.rayonKm} km autour d&apos;Enghien, à cheval sur le Hainaut,
              le Brabant wallon, le Brabant flamand et Bruxelles.
            </p>
            <div className="mt-6">
              <CarteZone />
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
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
            <p className="text-ardoise mt-6 text-sm">
              Votre commune n&apos;y figure pas ? Appelez-nous : nous vous dirons en une minute
              si nous couvrons votre adresse, sans vous faire remplir un formulaire pour rien.
            </p>
          </div>
        </div>
      </Section>

      <AppelFinal />
    </>
  );
}
