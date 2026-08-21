import type { Metadata } from 'next';
import { Article, PageLegale } from '@/components/site/page-legale';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { metadonnees } from '@/lib/site/seo';

export const metadata: Metadata = metadonnees({
  title: 'Politique de confidentialité et données personnelles — SUITON',
  description:
    'Quelles données SUITON collecte, pourquoi, combien de temps elles sont conservées et comment exercer vos droits (RGPD).',
  chemin: '/confidentialite',
  noindex: true,
});

export default function PageConfidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      miseAJour="14 août 2026"
      chemin="/confidentialite"
    >
      <Article titre="Responsable du traitement">
        <p>
          {ENTREPRISE.nom}, {ENTREPRISE.adresse}, {ENTREPRISE.codePostal} {ENTREPRISE.commune},
          Belgique — TVA {ENTREPRISE.tva}. Pour toute question relative à vos données :{' '}
          {ENTREPRISE.email}.
        </p>
      </Article>

      <Article titre="Données collectées et finalités">
        <p>
          <strong>Demande de devis.</strong> Nom, adresse de courriel, numéro de téléphone,
          adresse du chantier, surface, type de bien, niveau de salissure, date souhaitée,
          éventuel numéro de TVA. Ces données servent exclusivement à établir le devis et à
          organiser l&apos;intervention. Base légale : exécution de mesures précontractuelles à
          votre demande (art. 6.1.b RGPD).
        </p>
        <p>
          <strong>Photographies de chantier.</strong> Les photos que vous nous transmettez
          servent à chiffrer, et celles que nous prenons sur place constituent le rapport
          avant/après qui vous est remis. Base légale : exécution du contrat. Toute publication
          de ces photos à des fins commerciales fait l&apos;objet d&apos;un consentement
          distinct, révocable à tout moment, et jamais présélectionné.
        </p>
        <p>
          <strong>Facturation.</strong> Les données nécessaires à l&apos;émission des factures
          sont traitées au titre d&apos;une obligation légale (art. 6.1.c RGPD).
        </p>
      </Article>

      <Article titre="Données de localisation contenues dans les photos">
        <p>
          Les photographies transmises contiennent fréquemment des métadonnées EXIF, dont des
          coordonnées GPS. Nous les supprimons systématiquement au moment du dépôt, avant tout
          stockage : les images conservées ne contiennent aucune donnée de position.
        </p>
      </Article>

      <Article titre="Durées de conservation">
        <p>
          Demandes sans suite : 12 mois. Dossiers clients et rapports de chantier : 10 ans,
          durée de conservation légale des pièces comptables en Belgique. Photographies non
          contractuelles : supprimées à la clôture du dossier, sauf consentement de publication
          en cours de validité.
        </p>
      </Article>

      <Article titre="Destinataires">
        <p>
          Vos données ne sont ni vendues, ni louées, ni transmises à des fins publicitaires.
          Elles sont accessibles à nos sous-traitants techniques, dans la stricte mesure
          nécessaire : Supabase (hébergement de la base et des documents, région UE), Vercel
          (hébergement du site), Resend (envoi des courriels transactionnels), et notre
          prestataire de facturation électronique pour la transmission Peppol.
        </p>
      </Article>

      <Article titre="Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation, d&apos;opposition et de portabilité. Vous pouvez retirer à tout moment un
          consentement donné, sans que cela affecte la licéité du traitement antérieur. Écrivez
          à {ENTREPRISE.email} : nous répondons dans un délai d&apos;un mois.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de l&apos;Autorité de
          protection des données, rue de la Presse 35, 1000 Bruxelles.
        </p>
      </Article>

      <Article titre="Cookies et mesure d’audience">
        <p>
          Ce site ne dépose aucun cookie publicitaire. Seuls des cookies strictement nécessaires
          au fonctionnement sont utilisés : maintien de session dans l&apos;espace client et
          dans l&apos;application de gestion. Ils ne requièrent pas de consentement préalable.
        </p>
        <p>
          La fréquentation du site est mesurée par Vercel Web Analytics et Vercel Speed
          Insights. Cette mesure est <strong>anonyme et sans cookie</strong> : aucun identifiant
          persistant n&apos;est déposé sur votre appareil et aucun profil n&apos;est constitué.
          Les données sont agrégées et traitées au sein de l&apos;Union européenne.
        </p>
        <p>
          Si Google Analytics devait être activé, il ne serait chargé qu&apos;après votre
          consentement explicite, recueilli par une bannière offrant « Refuser » aussi
          visiblement que « Accepter ». Vous pourriez revenir sur ce choix à tout moment en
          effaçant les données de site de votre navigateur.
        </p>
      </Article>
    </PageLegale>
  );
}
