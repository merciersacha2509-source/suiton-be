import type { ServiceType, SoilLevel, PropertyType } from '@/types/database';
import type { PhotoDeposee } from '@/components/site/photo-uploader';

export type { GrillePublique } from '@/lib/pricing';
export type { PhotoDeposee } from '@/components/site/photo-uploader';

export interface Creneau {
  debut: string;
  fin: string;
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

/*
 * Une seule prestation passe par ce parcours : le nettoyage de fin de
 * travaux (construction neuve ou renovation confondues). Les vitres seules
 * suivent un parcours dedie sur /nettoyage-de-vitres (visite sur place,
 * pas d'estimation automatique) — il n'y a donc plus d'etape "Service" a
 * choisir ici, le client ne peut pas hesiter sur la prestation.
 */
export const ETAPES = [
  { numero: 1, titre: 'Où se trouve le chantier ?', court: 'Lieu' },
  { numero: 2, titre: 'Surface et état', court: 'Surface' },
  { numero: 3, titre: 'Photos', court: 'Photos' },
  { numero: 4, titre: 'Créneau', court: 'Créneau' },
  { numero: 5, titre: 'Vos coordonnées', court: 'Contact' },
] as const;

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
