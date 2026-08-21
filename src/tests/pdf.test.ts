import { describe, expect, it } from 'vitest';
import {
  composerDevis,
  composerFacture,
  composerRapport,
  decouperForfaits,
  type EntreesDevis,
  type EntreesFacture,
} from '@/lib/pdf/compose';
import { SETTINGS } from './fixtures';

const CLIENT_PARTICULIER = {
  nom: 'Jean Dupont',
  adresse: 'Rue de la Station 24',
  codePostal: '1400',
  commune: 'Nivelles',
};

const CLIENT_PRO = { ...CLIENT_PARTICULIER, nom: 'Delvaux SA', tva: 'BE0123456789' };

const CHANTIER = {
  service: 'fin_de_chantier' as const,
  property_type: 'maison' as const,
  soil: 'standard' as const,
  surface_m2: 140,
  adresse: 'Rue de la Station 24',
  code_postal: '1400',
  commune: 'Nivelles',
  zone: 'secondaire' as const,
  dateSouhaitee: new Date('2026-10-05T00:00:00Z'),
  dureeMin: 280,
  dureeMax: 390,
};

const DEVIS: EntreesDevis = {
  numero: 'SUITON-D-2026-0148',
  emisLe: new Date('2026-09-13T00:00:00Z'),
  valideJusquAu: new Date('2026-10-13T00:00:00Z'),
  referenceChantier: 'SUITON-2026-0148',
  client: CLIENT_PARTICULIER,
  chantier: CHANTIER,
  fraisZone: 25,
  majorationUrgence: 0,
  montantHtva: 1145,
  tvaTaux: 0.21,
  tvaMontant: 240.45,
  montantTtc: 1385.45,
  mentionTva: '',
  settings: SETTINGS,
};

const FACTURE: EntreesFacture = {
  numero: 'SUITON-F-2026-0031',
  emisLe: new Date('2026-10-06T00:00:00Z'),
  echeanceLe: new Date('2026-10-21T00:00:00Z'),
  communication: '+++202/6000/03175+++',
  client: CLIENT_PARTICULIER,
  chantier: {
    service: 'fin_de_chantier',
    surface_m2: 140,
    adresse: 'Rue de la Station 24',
    code_postal: '1400',
    commune: 'Nivelles',
    zone: 'secondaire',
    dateIntervention: new Date('2026-10-05T00:00:00Z'),
  },
  devisReference: 'SUITON-D-2026-0148',
  fraisZone: 25,
  majorationUrgence: 0,
  montantHtva: 1145,
  tvaTaux: 0.21,
  tvaMontant: 240.45,
  montantTtc: 1385.45,
  settings: SETTINGS,
};

/* -------------------------------------------------------------------------- */

describe('découpage en forfaits', () => {
  it('la somme des lignes égale toujours le total HTVA', () => {
    for (const montant of [500, 1145, 3744, 987.43, 12345.67]) {
      const lignes = decouperForfaits('fin_de_chantier', montant, 140, {
        fraisZone: 25,
        majorationUrgence: 0,
      });
      const somme = lignes.reduce(
        (s, l) => s + Number(l.total.replace(/[^0-9,-]/g, '').replace(',', '.')),
        0,
      );
      // Le dernier forfait absorbe l'arrondi : sans cela, la somme des lignes
      // differe du total et fait douter de tout le document.
      expect(Math.abs(somme - montant)).toBeLessThan(0.02);
    }
  });

  it("n'affiche jamais de prix au m² — un forfait se discute en bloc", () => {
    const lignes = decouperForfaits('fin_de_chantier', 1145, 140, {
      fraisZone: 0,
      majorationUrgence: 0,
    });
    for (const l of lignes) {
      expect(l.unite).toBe('forfait');
      expect(l.quantite).toBe('1');
    }
  });

  it('ajoute déplacement et majoration uniquement quand ils existent', () => {
    const sans = decouperForfaits('vitres', 400, 40, { fraisZone: 0, majorationUrgence: 0 });
    expect(sans.some((l) => l.description === 'Déplacement')).toBe(false);
    expect(sans.some((l) => l.description.includes('Majoration'))).toBe(false);

    const avec = decouperForfaits('vitres', 400, 40, { fraisZone: 25, majorationUrgence: 80 });
    expect(avec.some((l) => l.description === 'Déplacement')).toBe(true);
    expect(avec.some((l) => l.description.includes('Majoration'))).toBe(true);
  });

  it('couvre les trois services', () => {
    for (const s of ['fin_de_chantier', 'apres_renovation', 'vitres'] as const) {
      const lignes = decouperForfaits(s, 1000, 100, { fraisZone: 0, majorationUrgence: 0 });
      expect(lignes.length).toBeGreaterThanOrEqual(2);
    }
  });
});

/* -------------------------------------------------------------------------- */

describe('devis', () => {
  it("n'émet aucune espace fine insécable — absente de Helvetica", () => {
    const d = composerDevis({
      ...DEVIS,
      montantHtva: 3744,
      montantTtc: 4530.24,
      tvaMontant: 786.24,
    });
    const valeurs = [
      d.sousTotal,
      d.total,
      d.tvaMontant,
      d.chantier.surface,
      d.chantier.dureeEstimee,
      ...d.lignes.flatMap((l) => [l.prixUnitaire, l.total]),
    ];
    for (const v of valeurs) {
      expect(v).not.toMatch(new RegExp('[\\u202f\\u2009]'));
    }
  });

  it('applique la TVA 21 % à un particulier', () => {
    const d = composerDevis(DEVIS);
    expect(d.tvaLibelle).toBe('TVA 21 % *');
    expect(d.noteTva).toContain('autoliquidation');
  });

  it("bascule en autoliquidation pour un assujetti belge et cite l'AR n° 1", () => {
    const d = composerDevis({
      ...DEVIS,
      client: CLIENT_PRO,
      tvaTaux: 0,
      tvaMontant: 0,
      montantTtc: 1145,
    });
    expect(d.tvaLibelle).toBe('TVA — autoliquidation *');
    expect(d.noteTva).toContain('article 20');
    expect(d.noteTva).toContain('AR n° 1');
  });

  it('reprend les cinq conditions du gabarit SUITON', () => {
    const d = composerDevis(DEVIS);
    expect(d.conditions).toHaveLength(5);
    expect(d.conditions[0]).toContain('30 jours');
    expect(d.conditions[1]).toContain('30 %');
    expect(d.conditions[2]).toContain('15 jours');
  });

  it('sépare la promesse commerciale des conditions', () => {
    // « Vitres comprises » n'est pas une condition juridique mais un argument
    // de vente : il vit dans un encadré à côté du prix, pas noyé dans les
    // mentions légales.
    const d = composerDevis(DEVIS);
    expect(d.inclus).toContain('Vitres et châssis compris');
    expect(d.inclus).toContain('Garantie retouche 48 h');
    expect(d.conditions.join(' ')).not.toContain('Garantie retouche');
  });

  it("calcule l'acompte depuis les réglages", () => {
    const d = composerDevis(DEVIS);
    expect(d.acompte).toContain('415'); // 30 % de 1 385,45
  });

  it('reporte les coordonnées légales et bancaires', () => {
    const d = composerDevis(DEVIS);
    expect(d.emetteur.tva).toBe('BE1040784957');
    expect(d.emetteur.peppol).toBe('9925:BE1040784957');
    expect(d.emetteur.iban).toBe('BE68 5390 0754 7034');
  });
});

/* -------------------------------------------------------------------------- */

describe('facture', () => {
  it("n'affiche l'encadré légal QUE en autoliquidation", () => {
    expect(composerFacture(FACTURE).mentionLegale).toBe('');

    const pro = composerFacture({
      ...FACTURE,
      client: CLIENT_PRO,
      tvaTaux: 0,
      tvaMontant: 0,
      montantTtc: 1145,
    });
    expect(pro.mentionLegale).toContain('Article 20');
    expect(pro.mentionLegale).toContain('acquitter par le preneur');
  });

  it('reprend la loi du 2 août 2002 et l’indemnité de 40 EUR', () => {
    const f = composerFacture(FACTURE);
    const texte = f.conditions.join(' ');
    expect(texte).toContain('2 août 2002');
    expect(texte).toContain('40 EUR');
    expect(texte).toContain('8 jours');
  });

  it('porte la communication structurée et les coordonnées bancaires', () => {
    const f = composerFacture(FACTURE);
    expect(f.paiement.communication).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
    expect(f.paiement.iban).toBe('BE68 5390 0754 7034');
    expect(f.paiement.bic).toBe('GKCCBEBB');
  });

  it('rappelle le devis de référence dans les deux blocs', () => {
    const f = composerFacture(FACTURE);
    expect(f.chantier.devisReference).toBe('SUITON-D-2026-0148');
    expect(f.echeance.devisReference).toBe('SUITON-D-2026-0148');
  });
});

/* -------------------------------------------------------------------------- */

describe('rapport', () => {
  const RAPPORT = {
    numero: 'SUITON-R-2026-0031',
    reference: 'SUITON-2026-0148',
    client: CLIENT_PARTICULIER,
    chantier: {
      service: 'fin_de_chantier' as const,
      property_type: 'maison' as const,
      soil: 'standard' as const,
      surface_m2: 140,
      adresse: 'Rue de la Station 24',
      code_postal: '1400',
      commune: 'Nivelles',
    },
    execution: {
      debut: new Date('2026-10-05T06:12:00Z'),
      fin: new Date('2026-10-05T11:47:00Z'),
      dureeReelleMin: 335,
      dureeEstimeeMin: 280,
      dureeEstimeeMaxMin: 390,
      equipe: 'Équipe 1',
    },
    etapes: [
      {
        ordre: 1,
        libelle: 'État des lieux',
        detail: '…',
        faitA: new Date('2026-10-05T06:12:00Z'),
      },
    ],
    paires: [{ numero: 1, piece: 'Cuisine', avant: null, apres: null }],
    observations: 'Rayure préexistante sur le châssis de la cuisine, photographiée.',
    garantieHeures: 48,
    garantieExpireLe: new Date('2026-10-07T11:47:00Z'),
    signataire: 'Sacha Mercier',
    signeLe: new Date('2026-10-05T11:47:00Z'),
    settings: SETTINGS,
  };

  it('qualifie une durée conforme', () => {
    expect(composerRapport(RAPPORT).execution.ecart).toContain('conforme');
  });

  it('annonce un dépassement comme non facturé', () => {
    const r = composerRapport({
      ...RAPPORT,
      execution: { ...RAPPORT.execution, dureeReelleMin: 450 },
    });
    expect(r.execution.ecart).toContain('non facturé');
  });

  it('signale un chantier plus rapide que prévu', () => {
    const r = composerRapport({
      ...RAPPORT,
      execution: { ...RAPPORT.execution, dureeReelleMin: 210 },
    });
    expect(r.execution.ecart).toContain('plus simple');
  });

  it('reprend intégralement les observations — jamais tronquées', () => {
    const longue = 'A'.repeat(1200);
    const r = composerRapport({ ...RAPPORT, observations: longue });
    expect(r.observations).toHaveLength(1200);
  });
});
