import type { Metadata } from 'next';
import { Article, PageLegale } from '@/components/site/page-legale';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { metadonnees } from '@/lib/site/seo';

export const metadata: Metadata = metadonnees({
  title: 'Mentions légales — SUITON, Enghien',
  description: `Mentions légales de ${ENTREPRISE.nom}, ${ENTREPRISE.adresse}, ${ENTREPRISE.codePostal} ${ENTREPRISE.commune}. TVA ${ENTREPRISE.tva}.`,
  chemin: '/mentions-legales',
  noindex: true,
});

export default function PageMentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" miseAJour="14 août 2026" chemin="/mentions-legales">
      <Article titre="Éditeur du site">
        <p>
          {ENTREPRISE.nom} — {ENTREPRISE.activite}
          <br />
          {ENTREPRISE.adresse}, {ENTREPRISE.codePostal} {ENTREPRISE.commune},{' '}
          {ENTREPRISE.paysNom}
          <br />
          Numéro d&apos;entreprise et de TVA : {ENTREPRISE.tva}
          <br />
          Identifiant Peppol : {ENTREPRISE.peppol}
          <br />
          Téléphone : {ENTREPRISE.telephone} — Courriel : {ENTREPRISE.email}
        </p>
        <p>Responsable de la publication : Sacha Mercier.</p>
      </Article>

      <Article titre="Hébergement">
        <p>
          Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723,
          États-Unis. Les données applicatives et les documents sont hébergés par Supabase, dans
          une région de l&apos;Union européenne (Francfort, Allemagne).
        </p>
      </Article>

      <Article titre="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus du site — textes, identité visuelle, photographies de
          chantiers, documents et modèles de rapports — est la propriété de {ENTREPRISE.nom},
          sauf mention contraire. Toute reproduction sans autorisation écrite préalable est
          interdite.
        </p>
        <p>
          Les photographies de chantiers ne sont publiées qu&apos;avec le consentement explicite
          du client concerné, recueilli séparément du contrat.
        </p>
      </Article>

      <Article titre="Prix affichés">
        <p>
          Les montants indiqués sur le site sont exprimés hors TVA et à titre indicatif. Le
          calculateur produit une estimation, non une offre : seul le devis écrit, daté et
          accepté, engage {ENTREPRISE.nom}. Les prix sont susceptibles d&apos;évoluer ; le devis
          fait foi pour la durée de validité qu&apos;il mentionne.
        </p>
      </Article>

      <Article titre="Limitation de responsabilité">
        <p>
          {ENTREPRISE.nom} met tout en œuvre pour que les informations publiées soient exactes
          et à jour, sans pouvoir le garantir. L&apos;éditeur ne saurait être tenu responsable
          d&apos;un dommage résultant de l&apos;usage de ces informations, ni d&apos;une
          indisponibilité temporaire du site.
        </p>
      </Article>

      <Article titre="Règlement des litiges">
        <p>
          Le droit belge s&apos;applique. En cas de litige, les tribunaux de
          l&apos;arrondissement judiciaire du Hainaut, division de Mons, sont seuls compétents,
          sauf disposition légale impérative contraire en faveur du consommateur.
        </p>
        <p>
          Les consommateurs peuvent également recourir à la plateforme européenne de règlement
          en ligne des litiges, ou saisir le Service de médiation pour le consommateur (SPF
          Économie).
        </p>
      </Article>
    </PageLegale>
  );
}
