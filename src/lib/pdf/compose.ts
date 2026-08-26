import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatEUR,
  formatRange,
  formatSurface,
} from '@/lib/format';
import type { Emetteur, PaireAvantApres, Partie } from '@/lib/pdf/blocks';
import type { LigneDocument } from '@/lib/pdf/quote-data';
import type {
  DonneesAttestation,
  DonneesBonIntervention,
  DonneesDevis,
  DonneesFacture,
  DonneesFicheChantier,
  DonneesRapport,
  DonneesRapportQualite,
  EtapeRapport,
} from '@/lib/pdf/documents/types';

type PartieClient = Partie;
type PaireRapport = PaireAvantApres;
import type {
  PropertyLabelMap,
  PropertyType,
  ServiceType,
  SettingsRow,
  SoilLevel,
} from '@/types/database';

/* ==========================================================================
 * Libelles
 * ======================================================================== */

export const LIBELLES_SERVICE: Record<ServiceType, string> = {
  fin_de_chantier: 'Nettoyage de fin de travaux',
  vitres: 'Nettoyage de vitres',
};

export const LIBELLES_SALISSURE: Record<SoilLevel, string> = {
  standard: 'standard',
  lourd: 'lourde',
};

export const LIBELLES_BIEN: PropertyLabelMap = {
  studio: 'Studio',
  appartement: 'Appartement',
  maison: 'Maison',
  villa: 'Villa',
  bureaux: 'Bureaux',
  commerce: 'Commerce',
  autre: 'Bien',
};

/* ==========================================================================
 * Normalisation typographique
 * ==========================================================================
 * Intl.NumberFormat('fr-BE') separe les milliers par une ESPACE FINE
 * INSECABLE (U+202F), absente de Helvetica. Le glyphe manquant se rend en
 * barre oblique : « 3 744,00 € » s'affiche « 3/744,00 € » sur le document du
 * client. On la remplace par une espace insecable ordinaire, presente dans
 * la police.
 * ======================================================================== */
function typo(valeur: string): string {
  return valeur.replace(new RegExp('[\\u202f\\u2009]', 'g'), ' ');
}

const eur = (n: number) => typo(formatEUR(n));

/* ==========================================================================
 * Decoupage en forfaits
 * ==========================================================================
 * Le gabarit SUITON presente la prestation en forfaits, pas en prix au m².
 * Ce n'est pas cosmetique : un prix au m² affiche invite a negocier le taux
 * — « 8 € le m², vous pouvez pas faire 6 ? ». Un forfait se discute en bloc,
 * ou pas du tout.
 *
 * La grille au m² reste le moteur de calcul ; elle n'apparait simplement
 * plus sur le document. La repartition ci-dessous fait toujours 100 % : le
 * total est reparti, jamais recalcule.
 * ======================================================================== */

interface Forfait {
  description: string;
  detail: (surface: number) => string;
  part: number;
}

const FORFAITS: Record<ServiceType, Forfait[]> = {
  fin_de_chantier: [
    {
      description: 'Nettoyage de fin de travaux — remise en état complète',
      detail: (s) => `Dépoussiérage intégral, ${s} m² traités`,
      part: 0.5,
    },
    {
      description: 'Traitement des sols et surfaces',
      detail: () => 'Aspiration fine, lavage, détartrage sanitaires et cuisine',
      part: 0.26,
    },
    {
      description: 'Nettoyage vitres et encadrements',
      detail: () => 'Intérieur, châssis, rainures et joints — jamais en supplément',
      part: 0.16,
    },
    {
      description: 'Évacuation des déchets de nettoyage',
      detail: () => 'Produits, matériel et évacuation compris',
      part: 0.08,
    },
  ],
  vitres: [
    {
      description: 'Nettoyage de vitres — intérieur et extérieur accessible',
      detail: (s) => `${s} m² de vitrage`,
      part: 0.74,
    },
    {
      description: 'Châssis, rainures et encadrements',
      detail: () => 'Détartrage des rainures, joints et appuis',
      part: 0.26,
    },
  ],
};

/**
 * Repartit un montant en forfaits.
 *
 * Le dernier forfait absorbe l'arrondi : sans cela, la somme des lignes
 * differe du total de quelques centimes, ce qui saute aux yeux sur un devis
 * et fait douter de tout le reste.
 */
export function decouperForfaits(
  service: ServiceType,
  montantHtva: number,
  surface: number,
  extras: { fraisZone: number; majorationUrgence: number; libelleZone?: string },
): LigneDocument[] {
  const base = Math.max(0, montantHtva - extras.fraisZone - extras.majorationUrgence);
  const modele = FORFAITS[service];

  const lignes: LigneDocument[] = [];
  let cumul = 0;

  modele.forEach((f, i) => {
    const dernier = i === modele.length - 1;
    const montant = dernier
      ? Math.round((base - cumul) * 100) / 100
      : Math.round(base * f.part * 100) / 100;
    cumul += montant;

    lignes.push({
      description: f.description,
      detail: f.detail(surface),
      quantite: '1',
      unite: 'forfait',
      prixUnitaire: eur(montant),
      total: eur(montant),
    });
  });

  if (extras.fraisZone > 0) {
    lignes.push({
      description: 'Déplacement',
      detail: extras.libelleZone,
      quantite: '1',
      unite: 'forfait',
      prixUnitaire: eur(extras.fraisZone),
      total: eur(extras.fraisZone),
    });
  }

  if (extras.majorationUrgence > 0) {
    lignes.push({
      description: 'Majoration délai court',
      detail: 'Intervention sous 15 jours',
      quantite: '1',
      unite: 'forfait',
      prixUnitaire: eur(extras.majorationUrgence),
      total: eur(extras.majorationUrgence),
    });
  }

  return lignes;
}

/* ==========================================================================
 * Emetteur
 * ======================================================================== */

export function composerEmetteur(settings: SettingsRow): Emetteur {
  const banque = settings.banque ?? { iban: '', bic: '', titulaire: 'SUITON' };
  return {
    denomination: settings.entreprise.denomination,
    adresse: settings.entreprise.adresse,
    codePostal: settings.entreprise.code_postal,
    commune: settings.entreprise.commune,
    pays: settings.entreprise.pays,
    tva: settings.entreprise.tva,
    peppol: settings.entreprise.peppol,
    telephone: settings.entreprise.telephone,
    email: settings.entreprise.email,
    iban: banque.iban,
    bic: banque.bic,
    titulaire: banque.titulaire,
  };
}

/* ==========================================================================
 * Devis
 * ======================================================================== */

export interface EntreesDevis {
  numero: string;
  emisLe: Date;
  valideJusquAu: Date;
  referenceChantier: string;

  client: PartieClient;

  chantier: {
    service: ServiceType;
    property_type: PropertyType;
    soil: SoilLevel;
    surface_m2: number;
    adresse: string | null;
    code_postal: string | null;
    commune: string;
    zone: 'principale' | 'secondaire' | 'exceptionnelle';
    dateSouhaitee: Date | null;
    dureeMin: number;
    dureeMax: number;
  };

  fraisZone: number;
  majorationUrgence: number;

  montantHtva: number;
  tvaTaux: number;
  tvaMontant: number;
  montantTtc: number;
  mentionTva: string;

  settings: SettingsRow;
}

export function composerDevis(e: EntreesDevis): DonneesDevis {
  const autoliquidation = e.tvaTaux === 0 && Boolean(e.client.tva);
  const acompte = (e.montantTtc * (e.settings.acompte_pct ?? 30)) / 100;

  return {
    numero: e.numero,
    dateEmission: formatDate(e.emisLe),
    validiteJours: e.settings.validite_devis_jours ?? 30,
    valideJusquAu: formatDate(e.valideJusquAu),

    client: e.client,

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      adresse: e.chantier.adresse ?? undefined,
      codePostal: e.chantier.code_postal ?? undefined,
      commune: e.chantier.commune,
      dateSouhaitee: e.chantier.dateSouhaitee
        ? formatDate(e.chantier.dateSouhaitee)
        : 'à convenir',
      surface: typo(formatSurface(e.chantier.surface_m2)),
      dureeEstimee: typo(
        `${formatDuration(e.chantier.dureeMin)} – ${formatDuration(e.chantier.dureeMax)}`,
      ),
    },

    lignes: decouperForfaits(e.chantier.service, e.montantHtva, e.chantier.surface_m2, {
      fraisZone: e.fraisZone,
      majorationUrgence: e.majorationUrgence,
      libelleZone: e.settings.zones[e.chantier.zone]?.libelle,
    }),

    sousTotal: eur(e.montantHtva),
    tvaLibelle: autoliquidation
      ? 'TVA — autoliquidation *'
      : `TVA ${(e.tvaTaux * 100).toFixed(0)} % *`,
    tvaMontant: eur(e.tvaMontant),
    total: eur(e.montantTtc),
    noteTva: autoliquidation
      ? '* Autoliquidation applicable pour les clients assujettis à la TVA, conformément à l’article 20 de l’AR n° 1 — TVA non portée en compte sur la facture.'
      : '* TVA 21 % applicable aux particuliers ; autoliquidation (art. 20, AR n° 1) pour les clients assujettis.',

    acompte: e.settings.acompte_pct > 0 ? eur(Math.round(acompte * 100) / 100) : null,

    conditions: [
      `Devis valable ${e.settings.validite_devis_jours ?? 30} jours à compter de sa date d’émission.`,
      `Acompte de ${Math.round(e.settings.acompte_pct ?? 30)} % à la commande, solde à la fin de la prestation, sauf accord contraire.`,
      `Paiement par virement bancaire dans les ${e.settings.delai_paiement_jours ?? 15} jours suivant la facturation.`,
      'Prix exprimés en euros. TVA 21 % pour les particuliers ; autoliquidation (art. 20, AR n° 1) pour les clients assujettis.',
      'Le présent devis porte exclusivement sur les prestations décrites ci-dessus ; toute demande complémentaire fera l’objet d’un avenant.',
    ],

    inclus:
      'Vitres et châssis compris — jamais en supplément. Rapport photo avant/après remis à la fin du chantier. Garantie retouche 48 h : un point non conforme est repris sans frais.',

    emetteur: composerEmetteur(e.settings),
  };
}

/* ==========================================================================
 * Facture
 * ======================================================================== */

export interface EntreesFacture {
  numero: string;
  emisLe: Date;
  echeanceLe: Date;
  communication: string;

  client: PartieClient;

  chantier: {
    service: ServiceType;
    surface_m2: number;
    adresse: string | null;
    code_postal: string | null;
    commune: string;
    zone: 'principale' | 'secondaire' | 'exceptionnelle';
    dateIntervention: Date | null;
  };

  devisReference: string;

  fraisZone: number;
  majorationUrgence: number;

  montantHtva: number;
  tvaTaux: number;
  tvaMontant: number;
  montantTtc: number;

  settings: SettingsRow;
}

export function composerFacture(e: EntreesFacture): DonneesFacture {
  const autoliquidation = e.tvaTaux === 0 && Boolean(e.client.tva);
  const delai = e.settings.delai_paiement_jours ?? 15;

  return {
    numero: e.numero,
    dateEmission: formatDate(e.emisLe),
    dateEcheance: formatDate(e.echeanceLe),

    client: e.client,

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      adresse: e.chantier.adresse ?? undefined,
      codePostal: e.chantier.code_postal ?? undefined,
      commune: e.chantier.commune,
      dateIntervention: e.chantier.dateIntervention
        ? formatDate(e.chantier.dateIntervention)
        : formatDate(e.emisLe),
      devisReference: e.devisReference,
    },

    lignes: decouperForfaits(e.chantier.service, e.montantHtva, e.chantier.surface_m2, {
      fraisZone: e.fraisZone,
      majorationUrgence: e.majorationUrgence,
      libelleZone: e.settings.zones[e.chantier.zone]?.libelle,
    }),

    sousTotal: eur(e.montantHtva),
    tvaLibelle: autoliquidation
      ? 'TVA — autoliquidation *'
      : `TVA ${(e.tvaTaux * 100).toFixed(0)} %`,
    tvaMontant: eur(e.tvaMontant),
    total: eur(e.montantTtc),

    mentionLegale: autoliquidation
      ? 'Autoliquidation — Article 20 de l’arrêté royal n° 1 relatif aux mesures tendant à assurer le paiement de la taxe sur la valeur ajoutée. TVA à acquitter par le preneur. Cette mention remplace la TVA sur la présente facture lorsque le client est assujetti avec dépôt de déclarations périodiques.'
      : '',

    paiement: {
      iban: e.settings.banque?.iban ?? '',
      bic: e.settings.banque?.bic ?? '',
      titulaire: e.settings.banque?.titulaire ?? e.settings.entreprise.denomination,
      communication: e.communication,
    },

    echeance: {
      dateFacturation: formatDate(e.emisLe),
      payableAu: formatDate(e.echeanceLe),
      delaiJours: delai,
      numeroFacture: e.numero,
      devisReference: e.devisReference,
    },

    conditions: [
      'Facture payable au plus tard à la date d’échéance mentionnée ci-dessus, sans escompte.',
      'Conformément à la loi du 2 août 2002 concernant la lutte contre le retard de paiement, tout retard entraîne de plein droit et sans mise en demeure préalable l’application d’un intérêt de retard ainsi qu’une indemnité forfaitaire de recouvrement de 40 EUR minimum.',
      'Toute contestation doit être adressée par écrit dans les 8 jours calendrier suivant la réception de la facture.',
      // Redondant avec l'encadre legal quand celui-ci est affiche : le
      // repeter dilue la mention obligatoire au lieu de la renforcer.
      ...(autoliquidation
        ? []
        : [
            'TVA 21 % applicable aux particuliers ; autoliquidation (art. 20, AR n° 1) pour les clients assujettis.',
          ]),
    ],

    emetteur: composerEmetteur(e.settings),
  };
}

/* ==========================================================================
 * Rapport
 * ======================================================================== */

export interface EntreesRapport {
  numero: string;
  reference: string;

  client: PartieClient;

  chantier: {
    service: ServiceType;
    property_type: PropertyType;
    soil: SoilLevel;
    surface_m2: number;
    adresse: string | null;
    code_postal: string | null;
    commune: string;
  };

  execution: {
    debut: Date;
    fin: Date;
    dureeReelleMin: number;
    dureeEstimeeMin: number;
    dureeEstimeeMaxMin: number;
    equipe: string;
  };

  etapes: { ordre: number; libelle: string; detail: string; faitA: Date }[];
  paires: {
    numero: number;
    piece: string;
    avant: string | null;
    apres: string | null;
    legende?: string;
  }[];
  observations: string;

  garantieHeures: number;
  garantieExpireLe: Date;

  signataire: string;
  signeLe: Date;

  settings: SettingsRow;
}

/** Qualifie l'ecart de duree. Un chiffre brut ne dit rien au client. */
function qualifierEcart(reelle: number, min: number, max: number): string {
  if (reelle < min) {
    return `${formatDuration(min - reelle)} de moins que l’estimation basse — chantier plus simple que prévu.`;
  }
  if (reelle <= max) {
    return 'conforme à l’estimation.';
  }
  return `${formatDuration(reelle - max)} de plus que l’estimation haute — supplément non facturé.`;
}

export function composerRapport(e: EntreesRapport): DonneesRapport {
  const heure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

  const etapes: EtapeRapport[] = e.etapes.map((s) => ({
    ordre: s.ordre,
    libelle: s.libelle,
    detail: s.detail,
    faitA: heure.format(s.faitA),
  }));

  const paires: PaireRapport[] = e.paires.map((p) => ({
    numero: p.numero,
    piece: p.piece,
    avant: p.avant,
    apres: p.apres,
    legende: p.legende,
  }));

  return {
    numero: e.numero,
    dateIntervention: formatDate(e.execution.debut),

    client: e.client,

    chantier: {
      reference: e.reference,
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      typeBien: LIBELLES_BIEN[e.chantier.property_type],
      surface: typo(formatSurface(e.chantier.surface_m2)),
      salissure: LIBELLES_SALISSURE[e.chantier.soil],
      adresse: e.chantier.adresse ?? undefined,
      codePostal: e.chantier.code_postal ?? undefined,
      commune: e.chantier.commune,
    },

    execution: {
      debut: heure.format(e.execution.debut),
      fin: heure.format(e.execution.fin),
      dureeReelle: typo(formatDuration(e.execution.dureeReelleMin)),
      dureeEstimee: typo(
        `${formatDuration(e.execution.dureeEstimeeMin)} – ${formatDuration(e.execution.dureeEstimeeMaxMin)}`,
      ),
      ecart: qualifierEcart(
        e.execution.dureeReelleMin,
        e.execution.dureeEstimeeMin,
        e.execution.dureeEstimeeMaxMin,
      ),
      equipe: e.execution.equipe,
    },

    etapes,
    paires,
    observations: e.observations,

    garantie: {
      heures: e.garantieHeures,
      expireLe: formatDateTime(e.garantieExpireLe),
    },

    signataire: e.signataire,
    signeLe: formatDateTime(e.signeLe),

    emetteur: composerEmetteur(e.settings),
  };
}

/* ==========================================================================
 * Bon d'intervention
 * ==========================================================================
 * Ce qui differencie un bon d'intervention utile d'une feuille inutile :
 * les points sensibles sont DEDUITS des donnees du chantier, pas saisis a
 * la main. Personne ne remplit un champ « attention a » avant chaque
 * chantier ; en revanche, une salissure lourde ou un chantier de plus de
 * 250 m² se deduisent tout seuls.
 * ======================================================================== */

const PRESTATIONS: Record<ServiceType, { libelle: string; detail: string }[]> = {
  fin_de_chantier: [
    {
      libelle: 'État des lieux',
      detail: 'Photographier chaque pièce avant toute intervention.',
    },
    {
      libelle: 'Protection du mobilier restant',
      detail: 'Bâches sur ce qui ne peut pas être déplacé, si le bien est occupé.',
    },
    {
      libelle: 'Dépoussiérage haut vers bas',
      detail: 'Plafonds, murs, corniches, radiateurs, plinthes.',
    },
    {
      libelle: 'Aspiration poussière fine',
      detail: 'Deux passages. La poussière de découpe ou de ponçage retombe.',
    },
    {
      libelle: 'Vitres et châssis',
      detail: 'Intérieur, rainures, joints. Jamais en supplément.',
    },
    { libelle: 'Sanitaires et cuisine', detail: 'Détartrage, robinetterie, plans de travail.' },
    { libelle: 'Sols et contrôle final', detail: 'Lavage, puis relecture pièce par pièce.' },
  ],
  vitres: [
    { libelle: 'État des lieux', detail: 'Repérer les vitrages inaccessibles ou fragilisés.' },
    { libelle: 'Vitres intérieures', detail: 'Raclette, finition sans trace.' },
    { libelle: 'Vitres extérieures accessibles', detail: 'Sans échafaudage ni nacelle.' },
    { libelle: 'Châssis et rainures', detail: 'Détartrage des rainures, joints et appuis.' },
    { libelle: 'Contrôle en lumière rasante', detail: 'Les traces ne se voient que de biais.' },
  ],
};

const MATERIEL: Record<ServiceType, string[]> = {
  fin_de_chantier: [
    'Aspirateur eau et poussière',
    'Escabeau',
    'Bâches de protection',
    'Raclettes vitres',
    'Décapant doux',
    'Sacs gravats',
  ],
  vitres: ['Raclettes', 'Perche télescopique', 'Eau osmosée', 'Grattoir vitres'],
};

function pointsSensibles(input: {
  soil: SoilLevel;
  surface: number;
  service: ServiceType;
  urgent: boolean;
  zone: string;
}): string[] {
  const points: string[] = [];

  if (input.soil === 'lourd') {
    points.push(
      'Salissure lourde annoncée : prévoir le décapant et compter large. Si l’état dépasse ce qui a été chiffré, photographier et appeler AVANT de commencer.',
    );
  }
  if (input.surface > 250) {
    points.push(
      `Grande surface (${input.surface} m²) : découper le chantier pièce par pièce et cocher au fur et à mesure, sinon on perd le fil.`,
    );
  }
  if (input.service === 'fin_de_chantier') {
    points.push(
      'Fin de chantier : la poussière de découpe retombe. Deux passages d’aspiration, le second après la pose des sols.',
    );
  }
  if (input.service === 'vitres') {
    points.push(
      'Contrôler les vitres en lumière rasante : les traces ne se voient que de biais.',
    );
  }
  if (input.urgent) {
    points.push(
      'Chantier urgent : le client a payé une majoration. Le délai est un engagement.',
    );
  }
  if (input.zone === 'exceptionnelle') {
    points.push('Hors zone habituelle : vérifier le trajet la veille, prévoir la marge.');
  }

  points.push(
    'Photographier AVANT de toucher à quoi que ce soit. Une paire avant/après par pièce, même numéro.',
  );

  // QUATRE points au maximum.
  //
  // Au-dela, personne ne lit : le cinquieme point dilue le premier. La liste
  // est deja triee du plus specifique au plus general, on garde donc les
  // trois premiers et la consigne photo, qui vaut pour tous les chantiers.
  if (points.length <= 4) return points;
  return [...points.slice(0, 3), points[points.length - 1] as string];
}

export interface EntreesBonIntervention {
  numero: string;
  reference: string;
  debut: Date;
  fin: Date;
  equipe: string;
  client: PartieClient & { telephone: string };
  chantier: {
    service: ServiceType;
    property_type: PropertyType;
    soil: SoilLevel;
    surface_m2: number;
    adresse: string | null;
    code_postal: string | null;
    commune: string;
    zone: string;
    urgent: boolean;
    notes: string | null;
  };
  accesNotes: string | null;
  settings: SettingsRow;
}

export function composerBonIntervention(e: EntreesBonIntervention): DonneesBonIntervention {
  const heure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });
  const dureeMinutes = Math.round((e.fin.getTime() - e.debut.getTime()) / 60_000);
  const adresseComplete = [e.chantier.adresse, e.chantier.code_postal, e.chantier.commune]
    .filter(Boolean)
    .join(' ');

  return {
    numero: e.numero,
    reference: e.reference,
    emetteur: composerEmetteur(e.settings),

    date: formatDate(e.debut),
    creneau: `${heure.format(e.debut)} – ${heure.format(e.fin)}`,
    dureePrevue: typo(formatDuration(dureeMinutes)),
    equipe: e.equipe,

    client: e.client,

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      typeBien: LIBELLES_BIEN[e.chantier.property_type],
      surface: typo(formatSurface(e.chantier.surface_m2)),
      salissure: LIBELLES_SALISSURE[e.chantier.soil],
      adresse: e.chantier.adresse ?? '(adresse à confirmer)',
      codePostal: e.chantier.code_postal ?? '',
      commune: e.chantier.commune,
      itineraire: `Itinéraire : maps.google.com — ${adresseComplete}`,
    },

    acces:
      e.accesNotes ??
      'Aucune consigne d’accès enregistrée. Appelez le client 30 minutes avant l’arrivée.',

    prestations: PRESTATIONS[e.chantier.service],

    pointsSensibles: pointsSensibles({
      soil: e.chantier.soil,
      surface: e.chantier.surface_m2,
      service: e.chantier.service,
      urgent: e.chantier.urgent,
      zone: e.chantier.zone,
    }),

    materiel: MATERIEL[e.chantier.service],
    precisionsClient: e.chantier.notes,
  };
}

/* ==========================================================================
 * Attestation de fin de chantier
 * ======================================================================== */

export interface EntreesAttestation {
  numero: string;
  reference: string;
  client: PartieClient;
  chantier: {
    service: ServiceType;
    property_type: PropertyType;
    surface_m2: number;
    adresse: string | null;
    code_postal: string | null;
    commune: string;
  };
  intervention: { debut: Date; fin: Date; dureeMin: number; equipe: string };
  garantieHeures: number;
  garantieExpireLe: Date;
  rapportNumero: string | null;
  signataire: string;
  settings: SettingsRow;
}

export function composerAttestation(e: EntreesAttestation): DonneesAttestation {
  const heure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

  return {
    numero: e.numero,
    reference: e.reference,
    emetteur: composerEmetteur(e.settings),
    dateEmission: formatDate(new Date()),

    client: e.client,

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      typeBien: LIBELLES_BIEN[e.chantier.property_type],
      surface: typo(formatSurface(e.chantier.surface_m2)),
      adresse: e.chantier.adresse ?? undefined,
      codePostal: e.chantier.code_postal ?? undefined,
      commune: e.chantier.commune,
    },

    intervention: {
      date: formatDate(e.intervention.debut),
      debut: heure.format(e.intervention.debut),
      fin: heure.format(e.intervention.fin),
      duree: typo(formatDuration(e.intervention.dureeMin)),
      equipe: e.intervention.equipe,
    },

    prestationsRealisees: PRESTATIONS[e.chantier.service].map((p) => p.libelle),

    garantie: { heures: e.garantieHeures, expireLe: formatDateTime(e.garantieExpireLe) },
    rapportNumero: e.rapportNumero,
    signataire: e.signataire,
  };
}

/* ==========================================================================
 * Fiche chantier — interne
 * ======================================================================== */

export interface EntreesFicheChantier {
  reference: string;
  etape: string;
  client: PartieClient & { score: number; bande: string; kind: string; telephone?: string };
  chantier: {
    service: ServiceType;
    property_type: PropertyType;
    soil: SoilLevel;
    surface_m2: number;
    commune: string;
    zone: string;
    urgent: boolean;
    notes: string | null;
  };
  economie: {
    estimationMin: number | null;
    estimationMax: number | null;
    devisTtc: number | null;
    factureTtc: number | null;
    dureeEstimeeMin: number;
    dureeEstimeeMax: number;
    dureeReelleMin: number | null;
  };
  checklist: { ordre: number; libelle: string; faitA: Date | null }[];
  historique: { date: Date; type: string; detail: string }[];
  settings: SettingsRow;
}

/** Qualifie un ecart de duree. Un chiffre brut ne dit rien. */
function ecartDuree(reelle: number, min: number, max: number): string {
  if (reelle < min) return `${formatDuration(min - reelle)} sous l’estimation basse`;
  if (reelle <= max) return 'dans la fourchette estimée';
  return `${formatDuration(reelle - max)} au-dessus de l’estimation haute`;
}

export function composerFicheChantier(e: EntreesFicheChantier): DonneesFicheChantier {
  const heure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

  return {
    numero: e.reference,
    reference: e.reference,
    emetteur: composerEmetteur(e.settings),
    editeeLe: formatDateTime(new Date()),
    etape: e.etape,

    client: { ...e.client, score: e.client.score, bande: e.client.bande, kind: e.client.kind },

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      typeBien: LIBELLES_BIEN[e.chantier.property_type],
      surface: typo(formatSurface(e.chantier.surface_m2)),
      salissure: LIBELLES_SALISSURE[e.chantier.soil],
      commune: e.chantier.commune,
      zone: e.chantier.zone,
      urgent: e.chantier.urgent,
    },

    economie: {
      estimation:
        e.economie.estimationMin !== null && e.economie.estimationMax !== null
          ? typo(formatRange(e.economie.estimationMin, e.economie.estimationMax))
          : '—',
      devis: e.economie.devisTtc !== null ? eur(e.economie.devisTtc) : null,
      facture: e.economie.factureTtc !== null ? eur(e.economie.factureTtc) : null,
      dureeEstimee: typo(
        `${formatDuration(e.economie.dureeEstimeeMin)} – ${formatDuration(e.economie.dureeEstimeeMax)}`,
      ),
      dureeReelle:
        e.economie.dureeReelleMin !== null
          ? typo(formatDuration(e.economie.dureeReelleMin))
          : null,
      ecartDuree:
        e.economie.dureeReelleMin !== null
          ? ecartDuree(
              e.economie.dureeReelleMin,
              e.economie.dureeEstimeeMin,
              e.economie.dureeEstimeeMax,
            )
          : null,
    },

    checklist: e.checklist.map((c) => ({
      ordre: c.ordre,
      libelle: c.libelle,
      faitA: c.faitA ? heure.format(c.faitA) : null,
    })),

    historique: e.historique.map((h) => ({
      date: formatDateTime(h.date),
      type: h.type,
      detail: h.detail,
    })),

    notes: e.chantier.notes,
  };
}

/* ==========================================================================
 * Rapport qualite — interne
 * ==========================================================================
 * Il repond a deux questions qu'aucun autre document ne pose : ou est parti
 * le temps, et qu'est-ce qui n'a pas ete photographie.
 * ======================================================================== */

/** Cadence de reference, en minutes par m², par niveau de salissure. */
const CADENCE_REFERENCE: Record<SoilLevel, { min: number; max: number }> = {
  standard: { min: 2.0, max: 2.8 },
  lourd: { min: 2.8, max: 4.0 },
};

export interface EntreesRapportQualite {
  numero: string;
  reference: string;
  chantier: { service: ServiceType; soil: SoilLevel; surface_m2: number; commune: string };
  execution: {
    debut: Date;
    fin: Date;
    dureeReelleMin: number;
    dureeEstimeeMin: number;
    dureeEstimeeMax: number;
    equipe: string;
  };
  etapes: { ordre: number; libelle: string; detail: string; faitA: Date }[];
  paires: { numero: number; piece: string; avant: boolean; apres: boolean }[];
  observations: string;
  settings: SettingsRow;
}

export function composerRapportQualite(e: EntreesRapportQualite): DonneesRapportQualite {
  const heure = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

  // Ecart entre chaque etape et la precedente : c'est la qu'on voit ou le
  // temps est parti, pas dans le total.
  const etapes = e.etapes.map((s, i) => {
    const precedente = i === 0 ? null : e.etapes[i - 1];
    return {
      ordre: s.ordre,
      libelle: s.libelle,
      detail: s.detail,
      faitA: heure.format(s.faitA),
      ecartMinutes: precedente
        ? Math.round((s.faitA.getTime() - precedente.faitA.getTime()) / 60_000)
        : null,
    };
  });

  const completes = e.paires.filter((p) => p.avant && p.apres);
  const incompletes = e.paires.filter((p) => !p.avant || !p.apres);

  const minutesParM2 = e.execution.dureeReelleMin / Math.max(1, e.chantier.surface_m2);
  const cadence = CADENCE_REFERENCE[e.chantier.soil];

  const appreciation =
    minutesParM2 < cadence.min
      ? 'Cadence au-dessus de la référence — vérifier que rien n’a été survolé.'
      : minutesParM2 <= cadence.max
        ? 'Cadence conforme à la référence.'
        : 'Cadence sous la référence — chantier plus dur que prévu, ou temps mal employé.';

  const ecart = e.execution.dureeReelleMin - e.execution.dureeEstimeeMax;

  const vigilance: string[] = [];
  if (incompletes.length > 0) {
    vigilance.push(
      `${incompletes.length} paire(s) photo incomplète(s) : ${incompletes
        .map((p) => p.piece)
        .join(', ')}. Sans les deux côtés, la comparaison ne prouve rien.`,
    );
  }
  if (completes.length === 0) {
    vigilance.push(
      'Aucune comparaison avant/après. C’est ce qui prouve le résultat au client et alimente les réalisations publiées.',
    );
  }
  if (ecart > 60) {
    vigilance.push(
      `Dépassement de ${formatDuration(ecart)} sur l’estimation haute. Si le cas se répète, la grille tarifaire est à revoir pour ce niveau de salissure.`,
    );
  }
  if (e.etapes.length < 6) {
    vigilance.push(`Procédure incomplète : ${e.etapes.length} étape(s) sur 6 validées.`);
  }
  const memeMinute =
    e.etapes.length >= 6 &&
    new Set(e.etapes.map((s) => Math.floor(s.faitA.getTime() / 60_000))).size <= 2;
  if (memeMinute) {
    vigilance.push(
      'Toutes les étapes ont été cochées au même moment : la checklist a été remplie après coup, ce qui lui retire sa valeur de preuve.',
    );
  }

  return {
    numero: e.numero,
    reference: e.reference,
    emetteur: composerEmetteur(e.settings),
    editeLe: formatDateTime(new Date()),

    chantier: {
      typePrestation: LIBELLES_SERVICE[e.chantier.service],
      surface: typo(formatSurface(e.chantier.surface_m2)),
      commune: e.chantier.commune,
      salissure: LIBELLES_SALISSURE[e.chantier.soil],
    },

    execution: {
      debut: heure.format(e.execution.debut),
      fin: heure.format(e.execution.fin),
      dureeReelle: typo(formatDuration(e.execution.dureeReelleMin)),
      dureeEstimee: typo(
        `${formatDuration(e.execution.dureeEstimeeMin)} – ${formatDuration(e.execution.dureeEstimeeMax)}`,
      ),
      ecartMinutes: ecart,
      ecartLibelle:
        ecart <= 0
          ? 'dans la fourchette estimée'
          : `${formatDuration(ecart)} au-dessus de l’estimation haute`,
      equipe: e.execution.equipe,
    },

    etapes,

    couverturePhoto: {
      pairesCompletes: completes.length,
      pairesIncompletes: incompletes.length,
      piecesCouvertes: completes.map((p) => p.piece),
    },

    observations: e.observations,

    rendement: {
      minutesParM2: `${minutesParM2.toFixed(1)} min`,
      reference: `${cadence.min}–${cadence.max} min`,
      appreciation,
    },

    pointsVigilance: vigilance,
  };
}
