import { describe, expect, it } from 'vitest';
import {
  composerBilan,
  construirePlan,
  modelePour,
  proposerDecision,
  raconter,
  type ModelePlaybook,
} from '@/lib/playbook';
import type { ResultatExperience } from '@/lib/experiences';
import type { Recommandation } from '@/lib/recommandations';

const MODELES: ModelePlaybook[] = [
  {
    code: 'hausse_tarifaire',
    titre: 'Hausse tarifaire ciblée',
    famille: 'tarification',
    description: '…',
    indicateur: 'ca_horaire',
    duree_jours: 60,
    seuil_effet_pct: 10,
    seuil_n: 5,
    prerequis: ['Figer le périmètre'],
    vigilance: ['Le taux d’acceptation'],
  },
  {
    code: 'nouvelle_equipe',
    titre: 'Nouvelle équipe',
    famille: 'planning',
    description: '…',
    indicateur: 'minutes_par_m2',
    duree_jours: 90,
    seuil_effet_pct: 15,
    seuil_n: 5,
    prerequis: [],
    vigilance: [],
  },
];

const reco = (): Recommandation => ({
  code: 'tarif:x',
  famille: 'tarification',
  titre: 'Augmenter de 12 % les maisons 110–180 m²',
  action: 'Passer le panier de 1 200 à 1 344 €.',
  gainMin: 3000,
  gainMax: 6000,
  gainNonMonetaire: null,
  chantiersConcernes: 20,
  confiance: 'bonne',
  urgence: 'ce_mois',
  explication: ['…'],
  hypotheses: ['…'],
  experience: { titre: '+12 % sur les maisons', hypothese: 'Le volume tient.', dureeJours: 60 },
  score: 100,
});

const resultat = (p: Partial<ResultatExperience>): ResultatExperience => ({
  verdict: 'positif',
  ecartPct: 14,
  conclusion: 'CA horaire évolue de +14 %.',
  suite: 'Résultat net. Vous pouvez généraliser.',
  confiance: 'bonne',
  reference: { n: 15, mediane: 60, q1: 57, q3: 63 },
  test: { n: 14, mediane: 68, q1: 65, q3: 71 },
  reserves: [],
  ...p,
});

/* -------------------------------------------------------------------------- */

describe('choix du modèle', () => {
  it('associe chaque famille à son playbook', () => {
    expect(modelePour('tarification', MODELES)?.code).toBe('hausse_tarifaire');
    expect(modelePour('planning', MODELES)?.code).toBe('nouvelle_equipe');
  });

  it('retombe sur un modèle plutôt que sur rien', () => {
    expect(modelePour('inconnue', MODELES)).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe('viabilité du plan', () => {
  it('refuse un test que le périmètre ne peut pas alimenter', () => {
    // Deux chantiers par trimestre : six mois d'attente pour un
    // « on ne peut pas savoir ».
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 0.6,
    });
    expect(plan.viable).toBe(false);
    expect(plan.obstacle).toContain('élargissez le périmètre');
  });

  it('allonge la durée quand le rythme est lent mais suffisant', () => {
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 1,
    });
    // 5 chantiers à 1/mois = 150 jours : au-delà des 60 du modèle, mais
    // sous le plafond de 180 — le test reste praticable.
    expect(plan.dureeJours).toBe(150);
    expect(plan.viable).toBe(true);
  });

  it('refuse un test qui demanderait plus de six mois', () => {
    // Au-dela, le marché et l'équipe auront changé : la mesure ne comparerait
    // plus la même entreprise à elle-même.
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 0.7,
    });
    expect(plan.viable).toBe(false);
    expect(plan.obstacle).toContain('marché aura changé');
  });

  it('garde la durée du modèle quand le rythme suffit', () => {
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 8,
    });
    expect(plan.dureeJours).toBe(60);
    expect(plan.chantiersAttendus).toBe(16);
  });

  it('signale l’absence totale d’historique sur le périmètre', () => {
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 0,
    });
    expect(plan.viable).toBe(false);
    expect(plan.obstacle).toContain('Aucun chantier récent');
  });

  it('reprend prérequis et points de vigilance du modèle', () => {
    const plan = construirePlan({
      recommandation: reco(),
      modele: MODELES[0]!,
      chantiersParMois: 8,
    });
    expect(plan.prerequis).toContain('Figer le périmètre');
    expect(plan.vigilance).toContain('Le taux d’acceptation');
  });
});

/* -------------------------------------------------------------------------- */

describe('décision finale', () => {
  it('propose de prolonger quand le test ne peut pas conclure', () => {
    const p = proposerDecision({
      resultat: resultat({ verdict: 'indeterminé', ecartPct: null }),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.decision).toBe('prolonger');
    expect(p.valeurMin).toBeNull();
  });

  it('propose d’arrêter sur un résultat négatif', () => {
    const p = proposerDecision({
      resultat: resultat({ verdict: 'negatif', ecartPct: -18 }),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.decision).toBe('arreter');
    expect(p.valeurMin).toBeNull();
  });

  it('traite un résultat nul comme une information, pas un échec', () => {
    const p = proposerDecision({
      resultat: resultat({ verdict: 'neutre', ecartPct: 3 }),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.decision).toBe('arreter');
    expect(p.justification).toContain('pas un échec');
  });

  it('n’attribue AUCUNE valeur à un résultat positif mais fragile', () => {
    // La regle la plus importante : on ne compte pas ce qu'on n'a pas prouve.
    const p = proposerDecision({
      resultat: resultat({ reserves: ['Les moitiés centrales se chevauchent.'] }),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.decision).toBe('prolonger');
    expect(p.valeurMin).toBeNull();
    expect(p.reserveAttribution).toContain('on ne compte pas ce qu’on n’a pas prouvé');
  });

  it('attribue la valeur estimée d’origine sur un résultat net', () => {
    const p = proposerDecision({
      resultat: resultat({}),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.decision).toBe('generaliser');
    // La valeur retenue est celle ESTIMEE A L'ORIGINE, jamais recalculee
    // apres coup pour coller au resultat.
    expect(p.valeurMin).toBe(3000);
    expect(p.valeurMax).toBe(6000);
  });

  it('accompagne toute valeur d’une réserve d’attribution', () => {
    const p = proposerDecision({
      resultat: resultat({}),
      gainAttenduMin: 3000,
      gainAttenduMax: 6000,
    });
    expect(p.reserveAttribution).toContain('estimation');
    expect(p.reserveAttribution).toContain('saison');
  });
});

/* -------------------------------------------------------------------------- */

describe('bilan de valeur — le logiciel se mesure lui-même', () => {
  const bilan = (p: Partial<Parameters<typeof composerBilan>[0]>) =>
    composerBilan({
      annee: 2027,
      generalisees: 0,
      arretees: 0,
      prolongees: 0,
      acceptees: 0,
      ecartees: 0,
      valeurAnnuelle: 0,
      ...p,
    });

  it('ne prétend rien quand rien n’a été mené à terme', () => {
    const b = bilan({});
    expect(b.qualification).toContain('n’a donc rien prouvé');
    expect(b.reserve).toBeNull();
  });

  it('reconnaît la valeur d’un échec sans le chiffrer', () => {
    const b = bilan({ arretees: 3 });
    expect(b.qualification).toContain('Savoir ce qui ne marche pas');
    expect(b.qualification).toContain('ne se chiffre pas');
  });

  it('accompagne toujours un montant d’une réserve d’attribution', () => {
    const b = bilan({ generalisees: 2, arretees: 1, valeurAnnuelle: 7400 });
    expect(b.reserve).not.toBeNull();
    expect(b.reserve).toContain('ne prouve pas une causalité');
  });

  it('distingue une généralisation sans valeur chiffrable', () => {
    const b = bilan({ generalisees: 1, valeurAnnuelle: 0 });
    expect(b.qualification).toContain('sans valeur chiffrable');
    expect(b.reserve).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe('mémoire d’entreprise', () => {
  it('produit un récit lisible dans trois ans', () => {
    const texte = raconter({
      titre: 'Hausse maisons',
      perimetre: 'maisons · 110–180 m² · Nivelles',
      intervention: '+8 % sur les maisons 140–160 m²',
      testDebut: '2027-03-01',
      testFin: '2027-05-01',
      decision: 'generaliser',
      conclusion: 'CA horaire +11 %, volume stable.',
      valeurAnnuelle: 4200,
    });

    expect(texte).toContain('En mars 2027');
    expect(texte).toContain('maisons · 110–180 m² · Nivelles');
    expect(texte).toContain('CA horaire +11 %');
    expect(texte).toContain('généralisé');
    expect(texte).toContain('4 200 €');
  });

  it('reste lisible sans valeur ni périmètre', () => {
    const texte = raconter({
      titre: 'Nouveau matériel',
      perimetre: null,
      intervention: null,
      testDebut: '2027-09-15',
      testFin: null,
      decision: 'arreter',
      conclusion: null,
      valeurAnnuelle: null,
    });
    expect(texte).toContain('En septembre 2027');
    expect(texte).toContain('arrêté');
    expect(texte).not.toContain('€');
  });
});
