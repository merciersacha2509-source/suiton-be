/**
 * Types de la base.
 *
 * En production ce fichier est GENERE :
 *   npm run db:types
 * (supabase gen types typescript --local > src/types/database.ts)
 *
 * La version ci-dessous est ecrite a la main pour que le Sprint 1 compile
 * sans instance Supabase demarree. Elle est volontairement limitee aux
 * tables utilisees par les ecrans du Sprint 1 ; la generation la remplacera
 * integralement des la premiere migration appliquee.
 */

export type AppRole = 'admin' | 'staff' | 'technicien' | 'partenaire';

export type JobStage =
  | 'nouveau'
  | 'contacte'
  | 'qualifie'
  | 'devis_a_produire'
  | 'devis_envoye'
  | 'relance'
  | 'negociation'
  | 'gagne'
  | 'planifie'
  | 'termine'
  | 'perdu';

export type InterventionStatus =
  | 'provisoire'
  | 'confirme'
  | 'en_route'
  | 'sur_place'
  | 'termine'
  | 'annule';

/*
 * Les enums Postgres `service_type` et `soil_level` contiennent encore
 * `apres_renovation` et `leger` (Postgres ne sait pas retirer une valeur
 * d'enum sans recreer le type et toutes les colonnes qui en dependent).
 * Ces deux valeurs restent donc valides en base mais mortes : plus aucune
 * ligne n'en porte apres la migration de nettoyage, et l'application ne les
 * propose ni ne les accepte plus jamais. Le type applicatif ci-dessous est
 * volontairement plus etroit que l'enum reel pour l'exprimer.
 */
export type ServiceType = 'fin_de_chantier' | 'vitres';
export type SoilLevel = 'standard' | 'lourd';
export type ZoneTier = 'principale' | 'secondaire' | 'exceptionnelle';
export type ClientKind = 'particulier' | 'professionnel';
export type ScoreBand = 'A+' | 'A' | 'B' | 'C';
export type NiveauConfiance = 'aucune' | 'faible' | 'moyenne' | 'bonne' | 'elevee';
export type BandeSurface = 'xs' | 's' | 'm' | 'l' | 'xl';
export type PropertyType =
  | 'studio'
  | 'appartement'
  | 'maison'
  | 'villa'
  | 'bureaux'
  | 'commerce'
  | 'autre';
export type PropertyLabelMap = Record<PropertyType, string>;
export type QuoteStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
export type InvoiceStatus = 'brouillon' | 'emise' | 'payee' | 'annulee';
export type PhotoPhase = 'avant' | 'apres' | 'contexte' | 'incident';
export type AutomationState = 'actif' | 'suspendu' | 'desactive';

export interface Profile {
  id: string;
  role: AppRole;
  nom: string;
  telephone: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  kind: ClientKind;
  nom: string;
  email: string;
  telephone: string;
  commune: string | null;
  code_postal: string | null;
  tva: string | null;
  score: number;
  score_band: ScoreBand;
  consent_photos: boolean;
  no_contact: boolean;
  created_at: string;
}

export interface JobRow {
  id: string;
  reference: string;
  client_id: string;
  partner_id: string | null;
  assigned_to: string | null;
  stage: JobStage;
  service: ServiceType;
  soil: SoilLevel;
  surface_m2: number;
  commune: string;
  zone: ZoneTier;
  urgent: boolean;
  date_souhaitee: string | null;
  estimation_min: number | null;
  estimation_max: number | null;
  created_at: string;
  updated_at: string;
}

export interface PriceBand {
  min: number;
  max: number;
}

export interface SettingsRow {
  id: boolean;
  prix_m2: Record<ServiceType, Record<SoilLevel, PriceBand>>;
  /**
   * Coefficient par type de bien. 1.000 = sans effet.
   * Ajuste par le dirigeant depuis les reglages, jamais par le systeme.
   */
  coef_bien: Record<PropertyType, number>;
  zones: Record<ZoneTier, { frais: number; libelle: string }>;
  majoration_urgence: number;
  seuil_surface_devis: number;
  tva_taux: number;
  delai_devis_heures: number;
  garantie_heures: number;
  tampon_trajet_min: number;
  acompte_pct: number;
  delai_paiement_jours: number;
  validite_devis_jours: number;
  banque: { iban: string; bic: string; titulaire: string };
  entreprise: {
    denomination: string;
    adresse: string;
    code_postal: string;
    commune: string;
    pays: string;
    tva: string;
    peppol: string;
    telephone: string;
    email: string;
    iban: string;
  };
  updated_at: string;
}

export interface AutomationRow {
  code: string;
  libelle: string;
  state: AutomationState;
  derniere_execution: string | null;
  dernier_succes: string | null;
  echecs_consecutifs: number;
  executions_total: number;
}

export interface QuoteRow {
  id: string;
  numero: string;
  job_id: string;
  status: QuoteStatus;
  vat_regime: 'standard_21' | 'autoliquidation' | 'exonere';
  montant_htva: number;
  tva_montant: number;
  montant_ttc: number;
  lignes: unknown;
  valide_jusqu_au: string;
  sent_at: string | null;
  accepted_at: string | null;
  refused_at: string | null;
  open_count: number;
  pdf_path: string | null;
  portal_sent_at: string | null;
  created_at: string;
}

export interface InterventionRow {
  id: string;
  job_id: string;
  team_id: string;
  status: InterventionStatus;
  starts_at: string;
  ends_at: string;
  travel_buffer_min: number;
  google_event_id: string | null;
  acces_notes: string | null;
}

export interface PhotoRow {
  id: string;
  job_id: string | null;
  phase: PhotoPhase;
  piece: string;
  paire: number | null;
  storage_path: string;
  thumb_path: string | null;
  exif_stripped: boolean;
  is_published: boolean;
  legende: string | null;
  created_at: string;
}

export interface PortalTokenRow {
  id: string;
  job_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  hits: number;
}

export interface TeamRow {
  id: string;
  nom: string;
  couleur: string;
  actif: boolean;
}

export interface EventRow {
  id: number;
  job_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ChecklistStep {
  ordre: number;
  libelle: string;
  detail: string;
  photo_requise: boolean;
  actif: boolean;
}

export interface ChecklistProgress {
  intervention_id: string;
  ordre: number;
  fait_at: string;
  note: string | null;
}

export interface VueTerrain {
  intervention_id: string;
  status: InterventionStatus;
  starts_at: string;
  ends_at: string;
  en_route_at: string | null;
  sur_place_at: string | null;
  acces_notes: string | null;
  job_id: string;
  reference: string;
  service: ServiceType;
  property_type: PropertyType;
  soil: SoilLevel;
  surface_m2: number;
  adresse: string | null;
  commune: string;
  code_postal: string | null;
  notes: string | null;
  client_nom: string;
  client_telephone: string;
  equipe_nom: string;
  team_id: string;
}
