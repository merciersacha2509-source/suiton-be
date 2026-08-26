import type { ServiceType } from '@/types/database';

/**
 * Contenu editorial des services.
 *
 * Source unique : ces donnees alimentent les pages, les metadonnees, le
 * JSON-LD, le sitemap et le maillage interne. Une modification ici se
 * propage partout — c'est ce qui evite qu'un titre de page et sa balise
 * title racontent deux choses differentes.
 */

export interface Service {
  slug: string;
  /** Type technique, quand le service correspond a un service SUITON OS. */
  type: ServiceType | null;
  nom: string;
  /** Titre H1. Different du nom : il porte l'intention de recherche. */
  h1: string;
  titleSeo: string;
  metaDescription: string;
  /** Phrase d'accroche, sous le H1. */
  accroche: string;
  /** Le probleme concret que ce service resout. */
  probleme: string;
  /** Ce qui est inclus, en clair. */
  inclus: string[];
  /** Ce qui n'est PAS inclus. Dire non evite les litiges. */
  exclus: string[];
  /** Deroulement, etape par etape. */
  deroulement: { titre: string; detail: string }[];
  /** Prix indicatif au m², repris de la grille. Affiche « a partir de ». */
  prixDepuis: number;
  faq: { question: string; reponse: string }[];
  /** Services connexes, pour le maillage interne. */
  connexes: string[];
}

export const SERVICES: Service[] = [
  {
    slug: 'nettoyage-fin-de-chantier',
    type: 'fin_de_chantier',
    nom: 'Nettoyage de fin de travaux',
    h1: 'Nettoyage de fin de travaux en Belgique',
    titleSeo: 'Nettoyage de fin de travaux | Devis en 60 secondes — SUITON',
    metaDescription:
      'Nettoyage de fin de travaux — construction neuve ou rénovation. Vitres et châssis compris, rapport photo avant/après, garantie 48 h. Devis ferme sous 24 h.',
    accroche:
      "Un chantier livré n'est pas un chantier propre. Que le bien soit neuf, rénové ou occupé pendant les travaux, nous le rendons livrable — avec la preuve du résultat.",
    probleme:
      "La poussière de découpe et de ponçage s'infiltre partout et retombe deux fois, y compris dans les pièces non concernées par les travaux. Les résidus de plâtre, de silicone et de colle résistent à un nettoyage classique. Un bien mal nettoyé se remarque immédiatement à la réception ou à la remise des clés — et c'est l'entrepreneur ou le propriétaire qu'on juge, pas le nettoyeur.",
    inclus: [
      'Protection du mobilier qui ne peut pas être déplacé, si le bien est occupé',
      'Dépoussiérage complet du haut vers le bas : plafonds, murs, corniches, radiateurs, plinthes',
      'Deux passages d’aspiration : la poussière de découpe ou de ponçage retombe après le premier',
      'Vitres intérieures, châssis, rainures et joints — jamais en supplément',
      'Sanitaires et cuisine : détartrage, robinetterie, plans de travail',
      'Sols lavés selon le revêtement, puis relecture pièce par pièce',
      'Évacuation des déchets de nettoyage',
    ],
    exclus: [
      'Évacuation des gravats et déchets de chantier (nous nettoyons, nous ne débarrassons pas)',
      'Vitres en hauteur nécessitant une nacelle ou un échafaudage',
      'Décapage de sols nécessitant une monobrosse industrielle',
      'Nettoyage de textiles et de tapis (nous aspirons, nous ne shampouinons pas)',
      'Traitement de moisissures ou de dégâts des eaux',
    ],
    deroulement: [
      {
        titre: 'État des lieux photographié',
        detail:
          'Chaque pièce avant intervention. Un dégât préexistant est signalé le jour même.',
      },
      {
        titre: 'Protection du mobilier',
        detail: 'Bâches sur ce qui ne peut pas être déplacé, si le bien est occupé.',
      },
      {
        titre: 'Dépoussiérage haut vers bas',
        detail:
          'Plafonds, murs, corniches, radiateurs, plinthes — y compris les pièces non concernées par les travaux.',
      },
      {
        titre: 'Aspiration fine, deux passages',
        detail: 'Le second une fois la poussière de découpe ou de ponçage retombée.',
      },
      {
        titre: 'Vitres et châssis',
        detail: 'Intérieur, rainures, joints. Contrôle en lumière rasante.',
      },
      { titre: 'Sanitaires et cuisine', detail: 'Détartrage, robinetterie, plans de travail.' },
      {
        titre: 'Sols et contrôle final',
        detail: 'Lavage adapté au revêtement, puis relecture pièce par pièce.',
      },
    ],
    prixDepuis: 7,
    faq: [
      {
        question: 'Les vitres sont-elles comprises dans le prix ?',
        reponse:
          "Oui, systématiquement. Vitres intérieures, châssis, rainures et joints sont inclus dans le prix annoncé. Beaucoup de sociétés les facturent en supplément — nous avons choisi l'inverse, parce qu'un chantier livré avec des vitres sales n'est pas un chantier livré.",
      },
      {
        question: 'Cette prestation couvre-t-elle aussi bien le neuf que la rénovation ?',
        reponse:
          "Oui. Construction neuve, gros œuvre, rénovation complète ou partielle, bureaux et locaux professionnels : le protocole est le même, seule la préparation change — un bien occupé demande une protection du mobilier que nous ajoutons systématiquement.",
      },
      {
        question: 'Puis-je rester dans le logement pendant l’intervention ?',
        reponse:
          'Oui, mais nous travaillons plus vite dans un logement vide. Si vous êtes présent, nous organisons le nettoyage pièce par pièce pour que vous gardiez toujours un espace utilisable.',
      },
      {
        question: 'Nettoyez-vous aussi les pièces qui n’ont pas été rénovées ?',
        reponse:
          "Oui, et c'est indispensable. La poussière de ponçage traverse les portes fermées. Nettoyer uniquement la pièce rénovée revient à ne rien nettoyer du tout.",
      },
      {
        question: 'Que se passe-t-il si un point ne me convient pas ?',
        reponse:
          'Vous avez 48 heures pour le signaler. Nous repassons sans frais et sans discussion. Un appel au 0489 21 01 24 suffit.',
      },
      {
        question: 'Travaillez-vous avec les entreprises générales et les promoteurs ?',
        reponse:
          "Oui, et c'est une part importante de notre activité. Nous proposons un suivi dédié, une facturation groupée et des délais garantis. La facturation se fait au format structuré Peppol, comme la loi belge l'exige depuis janvier 2026.",
      },
    ],
    connexes: ['nettoyage-de-vitres', 'nettoyage-appartement'],
  },

  {
    slug: 'nettoyage-appartement',
    type: 'fin_de_chantier',
    nom: 'Nettoyage d’appartement',
    h1: 'Nettoyage d’appartement après travaux',
    titleSeo: 'Nettoyage appartement après travaux | SUITON',
    metaDescription:
      "Nettoyage d'appartement après chantier ou rénovation. Accès en étage, protection des communs, vitres comprises. Rapport photo et garantie 48 h.",
    accroche:
      "En appartement, la contrainte n'est pas la surface : c'est l'accès, les voisins et les parties communes.",
    probleme:
      "Un appartement en fin de chantier pose des problèmes qu'une maison ne pose pas : ascenseur à protéger, palier à ne pas salir, horaires de copropriété à respecter, eau et électricité parfois pas encore raccordées. Une société qui n'y a pas pensé perd deux heures sur place.",
    inclus: [
      'Protection du palier et de l’ascenseur pendant l’intervention',
      'Dépoussiérage intégral, du haut vers le bas',
      'Vitres, châssis, rainures et balcon accessible',
      'Cuisine équipée : intérieur des meubles, hotte, plans de travail',
      'Salle de bain et WC détartrés',
      'Sols et contrôle final',
    ],
    exclus: [
      'Nettoyage des parties communes (sauf accord avec le syndic)',
      'Vitres extérieures au-delà du rez-de-chaussée sans accès sécurisé',
      'Évacuation des cartons et emballages de livraison',
    ],
    deroulement: [
      {
        titre: 'État des lieux photographié',
        detail: 'Chaque pièce, plus le palier avant notre passage.',
      },
      {
        titre: 'Protection des accès',
        detail: 'Palier et ascenseur, pour ne pas transporter la poussière.',
      },
      {
        titre: 'Dépoussiérage haut vers bas',
        detail: 'Plafonds, murs, corniches, radiateurs, plinthes.',
      },
      {
        titre: 'Vitres, châssis et balcon',
        detail: 'Intérieur et extérieur accessible depuis le balcon.',
      },
      { titre: 'Cuisine et sanitaires', detail: 'Intérieur des meubles, hotte, détartrage.' },
      { titre: 'Sols et contrôle final', detail: 'Lavage, puis relecture pièce par pièce.' },
    ],
    prixDepuis: 7,
    faq: [
      {
        question: 'Faut-il prévenir le syndic ?',
        reponse:
          "Pour une intervention classique, non. Si les parties communes doivent être nettoyées ou si l'ascenseur doit être bloqué, oui — prévenez-nous à la réservation, nous adaptons l'horaire.",
      },
      {
        question: "Et s'il n'y a pas encore d'eau ni d'électricité ?",
        reponse:
          'Nous pouvons intervenir sans électricité, mais pas sans eau. Signalez-le : nous prévoyons alors une réserve, ce qui allonge légèrement la durée.',
      },
      {
        question: 'Nettoyez-vous l’intérieur des armoires de cuisine ?',
        reponse:
          "Oui, systématiquement en fin de chantier. La poussière de découpe se dépose à l'intérieur des meubles même portes fermées : les joints d'un caisson neuf ne sont pas étanches, et l'aspiration d'une scie ne capte jamais tout. Nous vidons, aspirons et essuyons chaque caisson, tiroirs compris, avant le nettoyage des façades.",
      },
    ],
    connexes: ['nettoyage-fin-de-chantier', 'nettoyage-maison'],
  },

  {
    slug: 'nettoyage-maison',
    type: 'fin_de_chantier',
    nom: 'Nettoyage de maison',
    h1: 'Nettoyage de maison après chantier',
    titleSeo: 'Nettoyage maison après chantier | Devis rapide — SUITON',
    metaDescription:
      'Nettoyage de maison neuve ou rénovée : plusieurs niveaux, escaliers, garage, vitres comprises. Rapport photo avant/après et garantie retouche 48 h.',
    accroche:
      "Une maison, ce sont plusieurs niveaux, un escalier et souvent un garage. Trois endroits où la poussière s'accumule et qu'on oublie.",
    probleme:
      "Sur une maison, la difficulté est la coordination : nettoyer l'étage avant le rez-de-chaussée, sinon la poussière redescend. L'escalier se fait en dernier, le garage souvent jamais. Une équipe qui travaille dans le désordre repasse deux fois.",
    inclus: [
      'Dépoussiérage complet, étage par étage, du haut vers le bas',
      'Escaliers, rampes et nez de marches',
      'Vitres, châssis et rainures à tous les niveaux accessibles',
      'Cuisine et sanitaires détartrés',
      'Garage et buanderie si accessibles',
      'Sols et contrôle final pièce par pièce',
    ],
    exclus: [
      'Terrasses, allées et façades (nettoyage extérieur haute pression sur devis séparé)',
      'Combles non aménagés et vides sanitaires',
      'Évacuation des gravats',
    ],
    deroulement: [
      { titre: 'État des lieux photographié', detail: 'Chaque pièce, à tous les niveaux.' },
      {
        titre: 'Étage d’abord',
        detail: 'On descend, jamais l’inverse : sinon la poussière retombe sur le propre.',
      },
      {
        titre: 'Aspiration fine, deux passages',
        detail: 'Le second une fois la poussière retombée.',
      },
      { titre: 'Vitres et châssis', detail: 'Tous les niveaux accessibles sans échafaudage.' },
      {
        titre: 'Cuisine, sanitaires, escalier',
        detail: 'L’escalier en dernier, il concentre le passage.',
      },
      { titre: 'Sols et contrôle final', detail: 'Lavage, puis relecture pièce par pièce.' },
    ],
    prixDepuis: 7,
    faq: [
      {
        question: 'Le garage est-il compris ?',
        reponse:
          "S'il est accessible et vide, oui. S'il sert de stockage pendant le chantier, signalez-le : nous chiffrons séparément ou nous l'excluons clairement du devis.",
      },
      {
        question: 'Nettoyez-vous les terrasses et les allées ?',
        reponse:
          "Pas dans le forfait de fin de chantier. Le nettoyage extérieur haute pression fait l'objet d'un devis séparé — le dire clairement évite une déception à la réception.",
      },
      {
        question: 'Combien de personnes intervenez-vous ?',
        reponse:
          "Une personne pour une maison jusqu'à 150 m², deux au-delà. Au-delà de deux sur une petite surface, on se gêne plus qu'on ne s'aide — nous ne facturons pas du temps perdu.",
      },
    ],
    connexes: ['nettoyage-fin-de-chantier', 'nettoyage-de-vitres'],
  },

  {
    slug: 'nettoyage-de-vitres',
    type: 'vitres',
    nom: 'Nettoyage de vitres',
    h1: 'Nettoyage de vitres et châssis',
    titleSeo: 'Nettoyage de vitres et châssis | Sans trace — SUITON',
    metaDescription:
      'Nettoyage de vitres, châssis et encadrements. Intérieur et extérieur accessible, rainures détartrées, contrôle en lumière rasante. Devis après visite sur place.',
    accroche: 'Une vitre propre ne se remarque pas. Une vitre mal nettoyée se voit de la rue.',
    probleme:
      "Les traces ne se voient que de biais, en lumière rasante — jamais de face, au moment où on nettoie. C'est pour cela qu'un nettoyage de vitres se contrôle autrement qu'il ne se fait. Et les rainures de châssis, où s'accumulent poussière et silicone, sont presque toujours oubliées.",
    inclus: [
      'Vitres intérieures, sans trace',
      'Vitres extérieures accessibles depuis le sol ou un balcon',
      'Châssis, rainures et joints détartrés',
      'Appuis de fenêtre et encadrements',
      'Contrôle final en lumière rasante',
    ],
    exclus: [
      'Vitrages nécessitant une nacelle, un échafaudage ou des cordistes',
      'Vérandas et verrières de toiture',
      'Retrait de peinture ou de silicone durci (sur devis)',
    ],
    deroulement: [
      {
        titre: 'Repérage',
        detail: 'Vitrages inaccessibles ou fragilisés identifiés avant de commencer.',
      },
      { titre: 'Vitres intérieures', detail: 'Raclette, finition sans trace.' },
      { titre: 'Vitres extérieures accessibles', detail: 'Sans échafaudage ni nacelle.' },
      { titre: 'Châssis et rainures', detail: 'Détartrage des rainures, joints et appuis.' },
      { titre: 'Contrôle en lumière rasante', detail: 'Les traces ne se voient que de biais.' },
    ],
    prixDepuis: 4,
    faq: [
      {
        question: 'Pourquoi pas de prix affiché directement en ligne ?',
        reponse:
          "Parce qu'il dépend de trop de facteurs pour être honnête à distance : accessibilité, nombre de faces et de vitrages, hauteur, état des châssis. Décrivez votre besoin et ajoutez des photos si possible : nous revenons avec un devis sous 24 heures ouvrées, après une visite si nécessaire.",
      },
      {
        question: 'Intervenez-vous en hauteur ?',
        reponse:
          "Nous nettoyons ce qui est accessible depuis le sol, un balcon ou une échelle de sécurité. Au-delà, il faut une nacelle ou des cordistes : ce n'est pas notre métier, et nous préférons le dire que d'improviser.",
      },
      {
        question: 'Pourquoi les traces reviennent-elles ?',
        reponse:
          "Presque toujours à cause de l'eau utilisée ou du séchage. Nous contrôlons en lumière rasante avant de partir — c'est le seul angle sous lequel une trace se voit.",
      },
      {
        question:
          'Le nettoyage de vitres est-il compris dans un nettoyage de fin de chantier ?',
        reponse:
          "Oui, toujours, et sans supplément : vitres, châssis, rainures et seuils font partie du forfait de fin de chantier. C'est le poste que beaucoup de sociétés sortent du devis pour afficher un prix au m² plus bas, puis refacturent une fois sur place. Cette page-ci concerne les interventions où seules les vitres sont demandées, sans le reste du chantier.",
      },
    ],
    connexes: ['nettoyage-fin-de-chantier', 'nettoyage-maison'],
  },
];

export const parSlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
