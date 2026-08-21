import type { ServiceType, SoilLevel, PropertyType } from '@/types/database';

export type { GrillePublique } from '@/lib/pricing';

export interface Creneau {
  debut: string;
  fin: string;
}

export interface PhotoDeposee {
  id: string;
  apercu: string | null;
  nom: string;
}

export interface EtatReservation {
  service: ServiceType;
  property_type: PropertyType;
  soil: SoilLevel;
  surface_m2: number | '';
  commune: string;
  code_postal: string;
  adresse: string;
  urgent: boolean;
  date_souhaitee: string;
  photos: PhotoDeposee[];
  creneau: Creneau | null;
  nom: string;
  email: string;
  telephone: string;
  est_pro: boolean;
  tva: string;
  notes: string;
  consent_photos: boolean;
  consent_cgv: boolean;
}

export const ETAT_INITIAL: EtatReservation = {
  service: 'fin_de_chantier',
  property_type: 'maison',
  soil: 'standard',
  surface_m2: '',
  commune: '',
  code_postal: '',
  adresse: '',
  urgent: false,
  date_souhaitee: '',
  photos: [],
  creneau: null,
  nom: '',
  email: '',
  telephone: '',
  est_pro: false,
  tva: '',
  notes: '',
  consent_photos: false,
  consent_cgv: false,
};

export const ETAPES = [
  { numero: 1, titre: 'Service', court: 'Service' },
  { numero: 2, titre: 'Où se trouve le chantier ?', court: 'Lieu' },
  { numero: 3, titre: 'Surface et état', court: 'Surface' },
  { numero: 4, titre: 'Photos', court: 'Photos' },
  { numero: 5, titre: 'Créneau', court: 'Créneau' },
  { numero: 6, titre: 'Vos coordonnées', court: 'Contact' },
] as const;

export const SERVICES: { code: ServiceType; titre: string; description: string }[] = [
  {
    code: 'fin_de_chantier',
    titre: 'Fin de chantier',
    description:
      'Après gros œuvre ou construction neuve. Poussière de découpe, résidus, vitres.',
  },
  {
    code: 'apres_renovation',
    titre: 'Après rénovation',
    description: 'Après travaux dans un bien occupé ou remis en location.',
  },
  {
    code: 'vitres',
    titre: 'Vitres uniquement',
    description: 'Vitres, châssis et encadrements. Intérieur et extérieur accessible.',
  },
];

export const BIENS: { code: PropertyType; titre: string }[] = [
  { code: 'studio', titre: 'Studio' },
  { code: 'appartement', titre: 'Appartement' },
  { code: 'maison', titre: 'Maison' },
  { code: 'villa', titre: 'Villa' },
  { code: 'bureaux', titre: 'Bureaux' },
  { code: 'commerce', titre: 'Commerce' },
  { code: 'autre', titre: 'Autre' },
];

export const SALISSURES: { code: SoilLevel; titre: string; description: string }[] = [
  {
    code: 'leger',
    titre: 'Légère',
    description: 'Poussière fine, chantier propre, peu de résidus.',
  },
  {
    code: 'standard',
    titre: 'Standard',
    description: 'Cas le plus courant : poussière de découpe, traces, quelques résidus collés.',
  },
  {
    code: 'lourd',
    titre: 'Lourde',
    description: 'Résidus de peinture, ciment, colle, silicone. Décapage nécessaire.',
  },
];
