import type { Metadata } from 'next';
import { Article, PageLegale } from '@/components/site/page-legale';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { metadonnees } from '@/lib/site/seo';

export const metadata: Metadata = metadonnees({
  title: 'Conditions générales de vente et de prestation — SUITON',
  description:
    'Conditions générales de vente et de prestation de SUITON : devis, exécution, garantie retouche 48 h, paiement, autoliquidation TVA et facturation électronique.',
  chemin: '/conditions-generales',
  noindex: true,
});

export default function PageConditions() {
  return (
    <PageLegale
      titre="Conditions générales"
      miseAJour="14 août 2026"
      chemin="/conditions-generales"
    >
      <Article titre="1. Champ d’application">
        <p>
          Les présentes conditions régissent toute prestation de {ENTREPRISE.nom}. Elles priment
          sur les conditions d&apos;achat du client, sauf accord écrit contraire.
          L&apos;acceptation d&apos;un devis emporte acceptation des présentes.
        </p>
      </Article>

      <Article titre="2. Devis">
        <p>
          Les devis sont gratuits et valables 30 jours. Ils sont établis sur la base des
          informations communiquées par le client : surface, type de bien, niveau de salissure,
          accessibilité. Le montant est ferme pour ce périmètre.
        </p>
        <p>
          Si l&apos;état constaté sur place s&apos;écarte substantiellement de la description,{' '}
          {ENTREPRISE.nom} en informe le client avant de commencer, photographies à
          l&apos;appui. Le client choisit alors de maintenir le périmètre au prix convenu ou
          d&apos;accepter un avenant chiffré. Aucune prestation supplémentaire n&apos;est
          facturée sans accord écrit préalable.
        </p>
      </Article>

      <Article titre="3. Exécution">
        <p>
          Le client garantit l&apos;accès aux lieux à la date convenue, ainsi que la
          disponibilité d&apos;eau et d&apos;électricité. Les lieux doivent être libérés des
          gravats et déchets de chantier : leur évacuation ne fait pas partie de la prestation.
        </p>
        <p>
          Les dates d&apos;intervention sont données à titre indicatif. Un retard raisonnable ne
          peut donner lieu à indemnité. En cas de report imputable au client, un nouveau créneau
          est proposé sans frais s&apos;il est annoncé au moins 48 heures à l&apos;avance.
        </p>
      </Article>

      <Article titre="4. Réception et garantie retouche">
        <p>
          À la fin de l&apos;intervention, un rapport photographique horodaté est remis au
          client. Le client dispose de 48 heures pour signaler toute non-conformité.{' '}
          {ENTREPRISE.nom} intervient alors gratuitement sur les points signalés, dans les
          meilleurs délais.
        </p>
        <p>
          Passé ce délai, la prestation est réputée acceptée. Cette garantie ne couvre pas les
          salissures nouvelles postérieures à l&apos;intervention, notamment celles résultant de
          la poursuite de travaux.
        </p>
      </Article>

      <Article titre="5. Prix et paiement">
        <p>
          Les prix sont exprimés hors TVA. Sauf mention contraire, les factures sont payables à
          15 jours de date pour les particuliers et à 30 jours pour les professionnels.
        </p>
        <p>
          En cas de retard de paiement, un intérêt au taux légal en matière de transactions
          commerciales est dû de plein droit, ainsi qu&apos;une indemnité forfaitaire de
          recouvrement conforme à la législation belge. Pour les consommateurs, les montants et
          les délais de mise en demeure préalable prévus par le livre XIX du Code de droit
          économique s&apos;appliquent.
        </p>
      </Article>

      <Article titre="6. TVA et facturation électronique">
        <p>
          Pour les travaux immobiliers réalisés pour un assujetti établi en Belgique et tenu au
          dépôt de déclarations périodiques, la TVA est due par le cocontractant en application
          de l&apos;article 20 de l&apos;arrêté royal n° 1. La facture porte la mention «
          Autoliquidation ».
        </p>
        <p>
          Conformément à l&apos;obligation belge de facturation électronique entre assujettis,
          entrée en vigueur le 1<sup>er</sup> janvier 2026, les factures B2B sont émises au
          format électronique structuré et transmises via le réseau Peppol, sous
          l&apos;identifiant {ENTREPRISE.peppol}. Une copie PDF peut être fournie à titre de
          commodité ; elle n&apos;a pas valeur de facture originale.
        </p>
      </Article>

      <Article titre="7. Responsabilité">
        <p>
          {ENTREPRISE.nom} est assurée en responsabilité civile professionnelle. Tout dommage
          imputable à l&apos;intervention doit être signalé dans les 48 heures, par écrit et
          avec photographies.
        </p>
        <p>
          {ENTREPRISE.nom} ne répond pas des dommages résultant de l&apos;état préexistant des
          supports, de matériaux fragiles ou non protégés signalés comme tels dans l&apos;état
          des lieux initial, ni des défauts d&apos;exécution des autres corps de métier.
        </p>
      </Article>

      <Article titre="8. Droit de rétractation">
        <p>
          Le consommateur qui conclut un contrat hors établissement dispose d&apos;un délai de
          14 jours pour se rétracter, sans motif. S&apos;il demande expressément une exécution
          avant la fin de ce délai, il reste redevable du service déjà fourni au prorata.
        </p>
      </Article>

      <Article titre="9. Droit applicable">
        <p>
          Le droit belge s&apos;applique. Les tribunaux de l&apos;arrondissement judiciaire du
          Hainaut, division de Mons, sont seuls compétents, sauf disposition légale impérative
          contraire en faveur du consommateur.
        </p>
      </Article>
    </PageLegale>
  );
}
