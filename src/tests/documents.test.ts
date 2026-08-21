import { describe, expect, it } from 'vitest';
import {
  composerAttestation,
  composerBonIntervention,
  composerFicheChantier,
  composerRapportQualite,
} from '@/lib/pdf/compose';
import { DOCUMENTS, type TypeDocument } from '@/lib/pdf/tokens';
import type { EntreesBonIntervention } from '@/lib/pdf/compose';
import { SETTINGS } from './fixtures';

const CLIENT = {
  nom: 'Jean Dupont',
  adresse: 'Rue de la Station 24',
  codePostal: '1400',
  commune: 'Nivelles',
  telephone: '0475 88 12 40',
};

const D0 = new Date('2026-10-05T08:12:00+02:00');
const D1 = new Date('2026-10-05T13:47:00+02:00');

const CHANTIER_LEGER: EntreesBonIntervention['chantier'] = {
  service: 'vitres' as const,
  property_type: 'appartement' as const,
  soil: 'leger' as const,
  surface_m2: 60,
  adresse: 'Rue de la Station 24',
  code_postal: '1400',
  commune: 'Nivelles',
  zone: 'principale',
  urgent: false,
  notes: null,
};

const CHANTIER_LOURD: EntreesBonIntervention['chantier'] = {
  ...CHANTIER_LEGER,
  service: 'fin_de_chantier' as const,
  property_type: 'maison' as const,
  soil: 'lourd' as const,
  surface_m2: 320,
  zone: 'exceptionnelle',
  urgent: true,
};

const bon = (chantier: EntreesBonIntervention['chantier'], acces: string | null = null) =>
  composerBonIntervention({
    numero: 'SUITON-B-2026-0031',
    reference: 'SUITON-2026-0148',
    debut: D0,
    fin: D1,
    equipe: 'Équipe 1',
    client: CLIENT,
    chantier,
    accesNotes: acces,
    settings: SETTINGS,
  });

/* -------------------------------------------------------------------------- */

describe('collection documentaire', () => {
  it('déclare un destinataire pour chacun des sept documents', () => {
    const types = Object.keys(DOCUMENTS) as TypeDocument[];
    expect(types).toHaveLength(7);
    for (const t of types) {
      expect(['client', 'equipe', 'interne']).toContain(DOCUMENTS[t].destinataire);
      expect(DOCUMENTS[t].pied.length).toBeGreaterThan(3);
    }
  });

  it('marque les documents internes dans leur pied de page', () => {
    expect(DOCUMENTS.fiche_chantier.pied).toContain('INTERNE');
    expect(DOCUMENTS.rapport_qualite.pied).toContain('INTERNE');
    expect(DOCUMENTS.devis.pied).not.toContain('INTERNE');
  });
});

/* -------------------------------------------------------------------------- */

describe("bon d'intervention", () => {
  it('déduit les points sensibles du chantier — aucun n’est saisi à la main', () => {
    const leger = bon(CHANTIER_LEGER).pointsSensibles;
    const lourd = bon(CHANTIER_LOURD).pointsSensibles;

    expect(lourd.join(' ')).toContain('Salissure lourde');
    expect(lourd.join(' ')).toContain('320 m²');
    expect(leger.join(' ')).not.toContain('Salissure lourde');
  });

  it('n’en affiche jamais plus de quatre — le cinquième dilue le premier', () => {
    expect(bon(CHANTIER_LOURD).pointsSensibles.length).toBeLessThanOrEqual(4);
    expect(bon(CHANTIER_LEGER).pointsSensibles.length).toBeLessThanOrEqual(4);
  });

  it('rappelle toujours de photographier avant de commencer', () => {
    for (const c of [CHANTIER_LEGER, CHANTIER_LOURD]) {
      expect(bon(c).pointsSensibles.join(' ')).toContain('Photographier AVANT');
    }
  });

  it('donne une consigne utile quand aucun accès n’est enregistré', () => {
    expect(bon(CHANTIER_LEGER, null).acces).toContain('Appelez le client');
    expect(bon(CHANTIER_LEGER, 'Clé sous le pot').acces).toBe('Clé sous le pot');
  });

  it('adapte matériel et prestations au service', () => {
    expect(bon(CHANTIER_LEGER).materiel.join(' ')).toContain('Perche');
    expect(bon(CHANTIER_LOURD).materiel.join(' ')).toContain('gravats');
    expect(bon(CHANTIER_LOURD).prestations).toHaveLength(6);
    expect(bon(CHANTIER_LEGER).prestations.length).toBeLessThan(6);
  });

  it('ne porte AUCUN montant — un bon se perd sur un chantier', () => {
    const serialise = JSON.stringify(bon(CHANTIER_LOURD));
    expect(serialise).not.toMatch(/€/);
    expect(serialise).not.toMatch(/montant/i);
  });
});

/* -------------------------------------------------------------------------- */

describe('attestation de fin de chantier', () => {
  const attestation = composerAttestation({
    numero: 'SUITON-A-2026-0031',
    reference: 'SUITON-2026-0148',
    client: CLIENT,
    chantier: {
      service: 'fin_de_chantier',
      property_type: 'maison',
      surface_m2: 140,
      adresse: 'Rue de la Station 24',
      code_postal: '1400',
      commune: 'Nivelles',
    },
    intervention: { debut: D0, fin: D1, dureeMin: 335, equipe: 'Équipe 1' },
    garantieHeures: 48,
    garantieExpireLe: new Date('2026-10-07T13:47:00+02:00'),
    rapportNumero: 'SUITON-R-2026-0031',
    signataire: 'Sacha Mercier',
    settings: SETTINGS,
  });

  it('énumère les prestations réellement couvertes par le service', () => {
    expect(attestation.prestationsRealisees).toHaveLength(6);
    expect(attestation.prestationsRealisees.join(' ')).toContain('Vitres');
  });

  it('renvoie vers le rapport, qui porte la preuve', () => {
    expect(attestation.rapportNumero).toBe('SUITON-R-2026-0031');
  });

  it('porte la garantie et sa date d’expiration', () => {
    expect(attestation.garantie.heures).toBe(48);
    expect(attestation.garantie.expireLe).toContain('2026');
  });
});

/* -------------------------------------------------------------------------- */

describe('rapport qualité', () => {
  const etapes = [
    ['État des lieux', '08:12'],
    ['Dépoussiérage', '09:40'],
    ['Aspiration', '10:55'],
    ['Vitres', '11:48'],
    ['Sanitaires', '12:30'],
    ['Sols', '13:41'],
  ].map(([libelle, h], i) => ({
    ordre: i + 1,
    libelle: libelle as string,
    detail: '',
    faitA: new Date(`2026-10-05T${h}:00+02:00`),
  }));

  const qualite = (
    options: {
      dureeReelleMin?: number;
      etapes?: typeof etapes;
      paires?: { numero: number; piece: string; avant: boolean; apres: boolean }[];
    } = {},
  ) =>
    composerRapportQualite({
      numero: 'SUITON-Q-2026-0031',
      reference: 'SUITON-2026-0148',
      chantier: {
        service: 'fin_de_chantier',
        soil: 'standard',
        surface_m2: 140,
        commune: 'Nivelles',
      },
      execution: {
        debut: D0,
        fin: D1,
        dureeReelleMin: options.dureeReelleMin ?? 335,
        dureeEstimeeMin: 280,
        dureeEstimeeMax: 390,
        equipe: 'Équipe 1',
      },
      etapes: options.etapes ?? etapes,
      paires: options.paires ?? [{ numero: 1, piece: 'Séjour', avant: true, apres: true }],
      observations: 'RAS',
      settings: SETTINGS,
    });

  it('calcule l’écart entre chaque étape et la précédente', () => {
    const r = qualite();
    expect(r.etapes[0]?.ecartMinutes).toBeNull();
    expect(r.etapes[1]?.ecartMinutes).toBe(88); // 08:12 → 09:40
  });

  it('ne signale aucun point de vigilance sur un chantier conforme', () => {
    expect(qualite().pointsVigilance).toHaveLength(0);
  });

  it('signale une checklist cochée après coup', () => {
    const memeMinute = etapes.map((e) => ({ ...e, faitA: D1 }));
    expect(qualite({ etapes: memeMinute }).pointsVigilance.join(' ')).toContain('après coup');
  });

  it('signale les paires photo incomplètes', () => {
    const r = qualite({ paires: [{ numero: 1, piece: 'Cuisine', avant: true, apres: false }] });
    expect(r.couverturePhoto.pairesIncompletes).toBe(1);
    expect(r.pointsVigilance.join(' ')).toContain('Cuisine');
  });

  it('signale un dépassement franc de l’estimation', () => {
    expect(qualite({ dureeReelleMin: 520 }).pointsVigilance.join(' ')).toContain('Dépassement');
  });

  it('compare la cadence à une référence par niveau de salissure', () => {
    // 335 min / 140 m² = 2,4 min/m², dans la fourchette standard 2,0–2,8.
    expect(qualite().rendement.appreciation).toContain('conforme');
    expect(qualite({ dureeReelleMin: 140 }).rendement.appreciation).toContain('survolé');
  });
});

/* -------------------------------------------------------------------------- */

describe('fiche chantier', () => {
  const fiche = (dureeReelleMin: number | null) =>
    composerFicheChantier({
      reference: 'SUITON-2026-0148',
      etape: 'Terminé',
      client: { ...CLIENT, score: 104, bande: 'A', kind: 'particulier' },
      chantier: {
        service: 'fin_de_chantier',
        property_type: 'maison',
        soil: 'standard',
        surface_m2: 140,
        commune: 'Nivelles',
        zone: 'secondaire',
        urgent: false,
        notes: null,
      },
      economie: {
        estimationMin: 980,
        estimationMax: 1120,
        devisTtc: 1385.45,
        factureTtc: 1385.45,
        dureeEstimeeMin: 280,
        dureeEstimeeMax: 390,
        dureeReelleMin,
      },
      checklist: [{ ordre: 1, libelle: 'État des lieux', faitA: D0 }],
      historique: [{ date: D0, type: 'booking.created', detail: 'Réservation reçue' }],
      settings: SETTINGS,
    });

  it('qualifie l’écart de durée plutôt que d’afficher un chiffre brut', () => {
    expect(fiche(335).economie.ecartDuree).toContain('fourchette');
    expect(fiche(200).economie.ecartDuree).toContain('sous l’estimation');
    expect(fiche(500).economie.ecartDuree).toContain('au-dessus');
  });

  it('reste lisible sur un chantier non réalisé', () => {
    const f = fiche(null);
    expect(f.economie.dureeReelle).toBeNull();
    expect(f.economie.ecartDuree).toBeNull();
  });

  it('porte le score — information strictement interne', () => {
    expect(fiche(335).client.score).toBe(104);
    expect(fiche(335).client.bande).toBe('A');
  });
});
