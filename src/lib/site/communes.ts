import type { ZoneTier } from '@/types/database';

/**
 * Contenu editorial des pages locales.
 *
 * CHAQUE COMMUNE A UN CONTENU REELLEMENT DIFFERENT — parc immobilier,
 * contexte, contraintes d'acces, communes voisines.
 *
 * Ce n'est pas un scrupule esthetique. Huit pages produites par le meme
 * gabarit avec seulement le nom qui change ne sont pas huit pages : c'est
 * une page dupliquee huit fois, et Google la traite comme telle. Le
 * referencement local se gagne sur la specificite, pas sur le volume.
 */

export interface Commune {
  slug: string;
  nom: string;
  /** Nom en neerlandais, quand la commune est en Flandre. */
  nomNl?: string;
  codePostal: string;
  province: string;
  zone: ZoneTier;
  /** Distance depuis Enghien, en km. */
  distanceKm: number;
  /** Coordonnees, pour la carte de zone dessinee sur la page contact. */
  latitude: number;
  longitude: number;
  /** Temps de trajet realiste, aux heures ouvrables. */
  trajet: string;

  titleSeo: string;
  metaDescription: string;
  h1: string;

  /** Deux paragraphes propres a la commune. Le cœur de l'unicite. */
  contexte: string[];
  /** Le parc immobilier local, tel qu'il est. */
  parcImmobilier: string;
  /** Ce qui change concretement pour une intervention ici. */
  specificites: string[];
  /** Quartiers et lieux-dits, pour la longue traine. */
  quartiers: string[];
  /** Communes voisines, pour le maillage interne. */
  voisines: string[];
  /** Services les plus demandes localement. */
  servicesPhares: string[];
}

export const COMMUNES: Commune[] = [
  {
    slug: 'enghien',
    nom: 'Enghien',
    nomNl: 'Edingen',
    codePostal: '7850',
    province: 'Hainaut',
    zone: 'principale',
    distanceKm: 0,
    latitude: 50.6939,
    longitude: 4.0342,
    trajet: 'sur place',
    titleSeo: 'Nettoyage fin de chantier Enghien | SUITON, entreprise locale',
    metaDescription:
      'Entreprise de nettoyage de fin de chantier basée à Enghien. Intervention rapide, vitres comprises, rapport photo. Devis sous 24 h au 0489 21 01 24.',
    h1: 'Nettoyage de fin de chantier à Enghien',
    contexte: [
      "SUITON est basée rue Boussart, à Enghien. C'est notre commune : nous y intervenons sans frais de déplacement et souvent dans la journée quand un chantier se libère.",
      'Enghien occupe une position particulière, à la frontière linguistique entre le Hainaut et le Brabant flamand. Cela se retrouve dans le bâti : un centre ancien classé autour du parc, des lotissements des années 1970 vers Marcq et Petit-Enghien, et de la construction neuve en périphérie. Trois époques, trois façons de salir un chantier.',
    ],
    parcImmobilier:
      "Maisons de maître et bâti ancien dans le centre, où la poussière s'accumule dans les moulures et les parquets anciens. Lotissements des années 1970–1980 vers Petit-Enghien et Marcq, souvent en rénovation aujourd'hui. Constructions neuves en périphérie, avec les résidus de découpe typiques du gros œuvre récent.",
    specificites: [
      'Aucun frais de déplacement : nous sommes à Enghien.',
      'Interventions possibles le jour même quand un créneau se libère.',
      'Le centre ancien impose souvent un stationnement éloigné : nous le prévoyons dans la durée annoncée.',
      'Bâti ancien : moulures, parquets et châssis en bois demandent un traitement différent du neuf.',
    ],
    quartiers: ['Centre', 'Petit-Enghien', 'Marcq', 'Labliau', 'Parc d’Enghien'],
    voisines: ['hal', 'tubize', 'saint-pieters-leeuw'],
    servicesPhares: ['nettoyage-fin-de-chantier', 'nettoyage-de-vitres'],
  },

  {
    slug: 'nivelles',
    nom: 'Nivelles',
    codePostal: '1400',
    province: 'Brabant wallon',
    zone: 'secondaire',
    distanceKm: 25,
    latitude: 50.5977,
    longitude: 4.3268,
    trajet: '30 minutes',
    titleSeo: 'Nettoyage fin de chantier Nivelles | Devis 24 h — SUITON',
    metaDescription:
      'Nettoyage de fin de travaux à Nivelles. Constructions neuves, rénovations du centre historique. Vitres comprises, garantie 48 h.',
    h1: 'Nettoyage de fin de chantier à Nivelles',
    contexte: [
      "Nivelles est l'une des communes du Brabant wallon où l'on construit le plus. Les nouveaux quartiers résidentiels au sud et à l'est de la ville produisent un flux régulier de chantiers à livrer, et les délais y sont serrés : la réception provisoire tombe souvent quelques jours après la fin du gros œuvre.",
      "Le centre historique, autour de la collégiale Sainte-Gertrude, connaît lui un mouvement inverse : de la rénovation lourde dans du bâti ancien, avec les contraintes qui vont avec — accès étroits, planchers anciens, poussière qui s'infiltre chez les voisins.",
    ],
    parcImmobilier:
      'Constructions neuves en périphérie sud et est, avec résidus de découpe et poussière de plâtre typiques. Bâti ancien rénové dans le centre, où le ponçage de parquets et la dépose de cheminées laissent une poussière fine et tenace. Immeubles de rapport près de la gare, souvent divisés en appartements.',
    specificites: [
      'Forte activité de construction neuve : nous connaissons les délais de réception dans les nouveaux lotissements.',
      'Le zoning nord accueille des locaux professionnels et des surfaces commerciales, que nous traitons aussi.',
      'Trajet de 30 minutes depuis Enghien, ce qui permet une intervention en matinée avec départ à 7 h.',
      'Frais de déplacement forfaitaires de zone secondaire, annoncés sur le devis.',
    ],
    quartiers: [
      'Centre',
      'Collégiale',
      'Nivelles-Sud',
      'Baulers',
      'Bornival',
      'Thines',
      'Monstreux',
    ],
    voisines: ['braine-lalleud', 'tubize', 'waterloo'],
    servicesPhares: ['nettoyage-fin-de-chantier', 'nettoyage-maison'],
  },

  {
    slug: 'braine-lalleud',
    nom: "Braine-l'Alleud",
    codePostal: '1420',
    province: 'Brabant wallon',
    zone: 'secondaire',
    distanceKm: 28,
    latitude: 50.6836,
    longitude: 4.3676,
    trajet: '35 minutes',
    titleSeo: "Nettoyage fin de chantier Braine-l'Alleud | SUITON",
    metaDescription:
      "Nettoyage de fin de chantier et de villas à Braine-l'Alleud. Grandes surfaces, vitrages importants, rapport photo avant/après. Devis ferme sous 24 h.",
    h1: "Nettoyage de fin de chantier à Braine-l'Alleud",
    contexte: [
      "Braine-l'Alleud est une commune résidentielle où les surfaces sont sensiblement plus grandes qu'ailleurs dans le Brabant wallon. Les villas de 250 à 400 m² y sont courantes, souvent avec de grandes baies vitrées et plusieurs niveaux.",
      "Cela change la manière de travailler. Sur une villa, le vitrage représente une part bien plus importante du temps que sur une maison classique — parfois un tiers de l'intervention. Une société qui chiffre à la surface habitable sans regarder le vitrage se trompe systématiquement.",
    ],
    parcImmobilier:
      'Villas récentes et maisons quatre façades, souvent sur de grandes parcelles. Vitrages importants, vérandas, baies coulissantes. Quelques immeubles récents près de la gare et du centre, ainsi que du bâti plus ancien vers Lillois et Ophain.',
    specificites: [
      'Grandes surfaces : nous intervenons à deux au-delà de 150 m², ce qui divise la durée sans la doubler.',
      'Vitrages étendus : ils sont compris dans le prix, et nous les chiffrons sur base du linéaire réel, pas de la surface au sol.',
      "Plusieurs niveaux : nous travaillons de l'étage vers le rez, jamais l'inverse.",
      'Trajet de 35 minutes depuis Enghien, en zone secondaire.',
    ],
    quartiers: [
      'Centre',
      'Lillois-Witterzée',
      'Ophain-Bois-Seigneur-Isaac',
      'Le Chenois',
      'Mont-Saint-Pont',
    ],
    voisines: ['waterloo', 'nivelles', 'tubize'],
    servicesPhares: ['nettoyage-maison', 'nettoyage-de-vitres'],
  },

  {
    slug: 'waterloo',
    nom: 'Waterloo',
    codePostal: '1410',
    province: 'Brabant wallon',
    zone: 'secondaire',
    distanceKm: 32,
    latitude: 50.7157,
    longitude: 4.399,
    trajet: '40 minutes',
    titleSeo: 'Nettoyage fin de chantier Waterloo | Villas et rénovations',
    metaDescription:
      'Nettoyage de fin de travaux à Waterloo. Villas, biens de standing, remises en location. Rapport photo, garantie retouche 48 h.',
    h1: 'Nettoyage de fin de chantier à Waterloo',
    contexte: [
      "Waterloo compte une proportion inhabituelle de biens haut de gamme et de locations meublées, liée à la présence d'une population internationale. Les rotations locatives y sont fréquentes, et avec elles les remises en état entre deux occupants.",
      "L'exigence y est plus élevée qu'ailleurs, et le rapport photo avant/après y prend tout son sens : il documente l'état du bien à la remise des clés, ce qui simplifie la relation entre propriétaire, agence et locataire.",
    ],
    parcImmobilier:
      'Villas et maisons de standing, souvent avec dépendances et abords soignés. Appartements de standing dans le centre et le long de la chaussée de Bruxelles. Biens meublés en rotation locative régulière.',
    specificites: [
      "Remises en location fréquentes : le rapport photo sert de preuve d'état des lieux.",
      'Biens meublés : nous protégeons le mobilier plutôt que de le déplacer.',
      'Finitions haut de gamme : marbre, parquets huilés, robinetterie — chaque revêtement a son traitement.',
      'Trajet de 40 minutes depuis Enghien, en zone secondaire.',
    ],
    quartiers: ['Centre', 'Chenois', 'Mont-Saint-Jean', 'Joli-Bois', 'Butte du Lion'],
    voisines: ['braine-lalleud', 'bruxelles', 'nivelles'],
    servicesPhares: ['nettoyage-fin-de-chantier', 'nettoyage-maison'],
  },

  {
    slug: 'bruxelles',
    nom: 'Bruxelles',
    codePostal: '1000',
    province: 'Région de Bruxelles-Capitale',
    zone: 'secondaire',
    distanceKm: 30,
    latitude: 50.8467,
    longitude: 4.3525,
    trajet: '45 minutes',
    titleSeo: 'Nettoyage fin de chantier Bruxelles | Appartements et bureaux',
    metaDescription:
      'Entreprise de nettoyage de chantier à Bruxelles : appartements, immeubles de rapport, bureaux. Accès en étage, protection des communs, vitres comprises.',
    h1: 'Nettoyage de fin de chantier à Bruxelles',
    contexte: [
      "À Bruxelles, la difficulté n'est presque jamais la surface : c'est l'accès. Stationnement introuvable, ascenseur à réserver, parties communes à protéger, horaires de copropriété à respecter. Une intervention mal préparée perd deux heures avant même de commencer.",
      "Le parc bruxellois est dominé par l'appartement et l'immeuble de rapport, souvent en rénovation par plateau. La poussière y circule entre les niveaux par les cages d'escalier et les gaines techniques, ce qui oblige à traiter davantage que la seule unité rénovée.",
    ],
    parcImmobilier:
      'Immeubles de rapport en rénovation, appartements en division, maisons bruxelloises étroites et hautes. Plateaux de bureaux en réaménagement. Bâti ancien avec moulures, parquets et châssis bois, aux côtés de programmes neufs.',
    specificites: [
      'Stationnement et accès à préparer : nous appelons systématiquement la veille.',
      "Protection des parties communes pendant toute l'intervention.",
      'Maisons bruxelloises : trois à quatre niveaux étroits, escalier traité en dernier.',
      'Horaires de copropriété respectés — nous adaptons le créneau si nécessaire.',
    ],
    quartiers: [
      'Centre',
      'Ixelles',
      'Uccle',
      'Schaerbeek',
      'Anderlecht',
      'Etterbeek',
      'Forest',
    ],
    voisines: ['saint-pieters-leeuw', 'hal', 'waterloo'],
    servicesPhares: ['nettoyage-appartement', 'nettoyage-fin-de-chantier'],
  },

  {
    slug: 'tubize',
    nom: 'Tubize',
    codePostal: '1480',
    province: 'Brabant wallon',
    zone: 'secondaire',
    distanceKm: 15,
    latitude: 50.6919,
    longitude: 4.2028,
    trajet: '20 minutes',
    titleSeo: 'Nettoyage fin de chantier Tubize | Intervention rapide',
    metaDescription:
      "Nettoyage de fin de chantier à Tubize : logements neufs, reconversions industrielles, rénovations. À 20 minutes d'Enghien. Devis sous 24 h.",
    h1: 'Nettoyage de fin de chantier à Tubize',
    contexte: [
      "Tubize est l'une de nos communes les plus proches — vingt minutes depuis Enghien. C'est aussi l'une de celles où le bâti change le plus vite : la reconversion des anciennes friches industrielles, autour de Clabecq notamment, y produit régulièrement des programmes de logements neufs.",
      "Ces chantiers de reconversion ont une particularité : la poussière de béton et de découpe métallique y est plus abrasive que sur une construction classique. Elle raye si on l'essuie à sec, et un premier passage à l'aspiration est indispensable avant tout lavage.",
    ],
    parcImmobilier:
      'Programmes de logements neufs sur les anciennes friches industrielles. Maisons ouvrières du centre, souvent en rénovation. Lotissements récents vers Oisquercq et Saintes. Quelques bâtiments industriels reconvertis en lofts.',
    specificites: [
      'Vingt minutes depuis Enghien : nous pouvons intervenir en dernière minute.',
      'Chantiers de reconversion : poussière abrasive, aspiration avant tout lavage.',
      'Logements neufs livrés en série : nous pouvons traiter plusieurs unités le même jour.',
      'Zone secondaire, avec frais de déplacement réduits vu la proximité.',
    ],
    quartiers: ['Centre', 'Clabecq', 'Oisquercq', 'Saintes', 'Ripain'],
    voisines: ['enghien', 'braine-lalleud', 'hal'],
    servicesPhares: ['nettoyage-fin-de-chantier', 'nettoyage-appartement'],
  },

  {
    slug: 'hal',
    nom: 'Hal',
    nomNl: 'Halle',
    codePostal: '1500',
    province: 'Brabant flamand',
    zone: 'principale',
    distanceKm: 18,
    latitude: 50.7362,
    longitude: 4.2333,
    trajet: '25 minutes',
    titleSeo: 'Nettoyage fin de chantier Hal (Halle) | SUITON',
    metaDescription:
      'Nettoyage de fin de chantier à Hal / Halle. Zone principale, sans frais de déplacement. Vitres comprises, rapport photo, garantie 48 h.',
    h1: 'Nettoyage de fin de chantier à Hal',
    contexte: [
      "Hal — Halle en néerlandais — fait partie de notre zone principale : nous y intervenons sans frais de déplacement, comme à Enghien. Vingt-cinq minutes de route, et une position de nœud ferroviaire qui en fait une commune très demandée pour l'habitat.",
      "Cette attractivité se traduit par une densification continue : divisions d'immeubles anciens, petits programmes neufs près de la gare, rénovations lourdes dans le centre autour de la basilique. Beaucoup de chantiers de taille moyenne, livrés vite.",
    ],
    parcImmobilier:
      'Bâti ancien du centre autour de la basilique Saint-Martin, souvent divisé en appartements. Petits programmes neufs à proximité de la gare. Maisons mitoyennes en rénovation dans les quartiers périphériques. Quelques villas vers Lembeek et Buizingen.',
    specificites: [
      'Zone principale : aucun frais de déplacement, comme à Enghien.',
      'Commune néerlandophone : nous travaillons en français et en néerlandais sur place.',
      'Chantiers de taille moyenne livrés rapidement : nous nous adaptons aux délais courts.',
      "Centre historique : stationnement à prévoir, nous l'intégrons dans la durée annoncée.",
    ],
    quartiers: ['Centrum', 'Buizingen', 'Lembeek', 'Essenbeek', 'Sint-Rochus'],
    voisines: ['enghien', 'saint-pieters-leeuw', 'tubize'],
    servicesPhares: ['nettoyage-fin-de-chantier', 'nettoyage-appartement'],
  },

  {
    slug: 'saint-pieters-leeuw',
    nom: 'Sint-Pieters-Leeuw',
    codePostal: '1600',
    province: 'Brabant flamand',
    zone: 'secondaire',
    distanceKm: 22,
    latitude: 50.7789,
    longitude: 4.2417,
    trajet: '30 minutes',
    titleSeo: 'Nettoyage fin de chantier Sint-Pieters-Leeuw | SUITON',
    metaDescription:
      'Nettoyage de fin de chantier à Sint-Pieters-Leeuw : lotissements récents, maisons quatre façades, rénovations. Vitres comprises, devis sous 24 h.',
    h1: 'Nettoyage de fin de chantier à Sint-Pieters-Leeuw',
    contexte: [
      'Sint-Pieters-Leeuw est une commune périurbaine en croissance continue, à la limite sud-ouest de Bruxelles. Le bâti y est majoritairement récent : lotissements pavillonnaires, maisons quatre façades, jardins.',
      "C'est un profil de chantier assez homogène, ce qui a un avantage concret : nos estimations y sont particulièrement fiables. Une maison quatre façades de 160 m² à Ruisbroek se nettoie dans les mêmes durées qu'une maison équivalente à Vlezenbeek.",
    ],
    parcImmobilier:
      "Lotissements pavillonnaires des années 1980 à aujourd'hui, majoritairement des maisons quatre façades avec jardin. Quelques noyaux villageois anciens à Vlezenbeek et Oudenaken. Programmes récents près de Ruisbroek et Negenmanneke.",
    specificites: [
      'Bâti homogène : nos estimations de durée y sont parmi les plus fiables.',
      "Maisons avec jardin : les abords immédiats et la terrasse font l'objet d'un devis séparé.",
      'Commune néerlandophone : intervention et documents disponibles dans les deux langues.',
      'Trente minutes depuis Enghien, en zone secondaire.',
    ],
    quartiers: [
      'Centrum',
      'Ruisbroek',
      'Vlezenbeek',
      'Negenmanneke',
      'Oudenaken',
      'Sint-Laureins-Berchem',
    ],
    voisines: ['hal', 'bruxelles', 'enghien'],
    servicesPhares: ['nettoyage-maison', 'nettoyage-fin-de-chantier'],
  },
];

export const communeParSlug = (slug: string) => COMMUNES.find((c) => c.slug === slug);
