import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { produireAlertes, type Alerte, type EntreesAlertes } from '@/lib/alertes';
import {
  produireRecommandations,
  type EntreesRecommandations,
  type Recommandation,
} from '@/lib/recommandations';
import { analyserExperience, type ResultatExperience } from '@/lib/experiences';
import {
  composerBilan,
  construirePlan,
  modelePour,
  raconter,
  type BilanValeur,
  type DecisionFinale,
  type ModelePlaybook,
  type Plan,
} from '@/lib/playbook';
import {
  estimerAvecHistorique,
  type EstimationAssistee,
  type ReferenceEffective,
} from '@/lib/intelligence';
import { estimate } from '@/lib/pricing';
import type {
  NiveauConfiance,
  PropertyType,
  ServiceType,
  SettingsRow,
  SoilLevel,
  ZoneTier,
} from '@/types/database';

/**
 * Acces aux donnees operationnelles.
 *
 * Toutes les fonctions renvoient un resultat exploitable meme quand la base
 * est vide : c'est la condition pour que le tableau de bord s'affiche des le
 * premier jour, sans traitement d'exception dans chaque composant.
 */

export async function referenceEffective(
  propertyType: PropertyType,
  surface: number,
  soil: SoilLevel,
): Promise<ReferenceEffective> {
  const { data, error } = await createAdminClient().rpc('reference_effective', {
    p_property_type: propertyType,
    p_surface: surface,
    p_soil: soil,
  });

  const ligne = Array.isArray(data) ? data[0] : data;

  if (error || !ligne) {
    // Repli neutre : plutot une cadence par defaut annoncee comme telle
    // qu'une page en erreur.
    console.error('[analytics] référence indisponible', error?.message);
    return {
      minutesParM2: 2.4,
      q1: null,
      q3: null,
      n: 0,
      confiance: 'aucune',
      origine: 'catalogue',
    };
  }

  return {
    minutesParM2: Number(ligne.minutes_par_m2),
    q1: ligne.q1 !== null ? Number(ligne.q1) : null,
    q3: ligne.q3 !== null ? Number(ligne.q3) : null,
    n: Number(ligne.n),
    confiance: ligne.confiance as NiveauConfiance,
    origine: ligne.origine as 'observee' | 'catalogue',
  };
}

/** Estimation assistee pour un chiffrage. */
export async function estimationAssistee(params: {
  service: ServiceType;
  propertyType: PropertyType;
  surface: number;
  soil: SoilLevel;
  zone: ZoneTier;
  urgent: boolean;
  techniciens: number;
  settings: SettingsRow;
}): Promise<EstimationAssistee & { grille: { min: number; max: number } }> {
  const supabase = createAdminClient();

  const [reference, { data: comparables }] = await Promise.all([
    referenceEffective(params.propertyType, params.surface, params.soil),
    supabase
      .from('job_metrics')
      .select('facture_htva')
      .eq('property_type', params.propertyType)
      .eq('soil', params.soil)
      .eq('complet', true)
      .not('facture_htva', 'is', null),
  ]);

  const montants = (comparables ?? [])
    .map((c) => Number(c.facture_htva))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const mediane =
    montants.length > 0
      ? (montants[Math.floor((montants.length - 1) / 2)]! +
          montants[Math.ceil((montants.length - 1) / 2)]!) /
        2
      : null;

  const grille = estimate(
    {
      service: params.service,
      soil: params.soil,
      surface_m2: params.surface,
      zone: params.zone,
      urgent: params.urgent,
    },
    params.settings,
  );

  const assistee = estimerAvecHistorique({
    propertyType: params.propertyType,
    surface: params.surface,
    soil: params.soil,
    techniciens: params.techniciens,
    reference,
    medianeHtva: mediane,
    grilleMin: grille.min,
    grilleMax: grille.max,
  });

  return { ...assistee, grille: { min: grille.min, max: grille.max } };
}

/* ==========================================================================
 * Indicateurs du tableau de bord
 * ======================================================================== */

export interface IndicateursOperationnels {
  chantiersComplets: number;
  medianeMinutesM2: number | null;
  caHoraire: number | null;
  precisionEstimation: number | null;
  ecartFacturationMoyen: number | null;
  couverturePhoto: number | null;
  tauxRetouche: number | null;
  noteMoyenne: number | null;
  checklistsSuspectes: number;
  confiance: NiveauConfiance;
}

export async function indicateurs(): Promise<IndicateursOperationnels> {
  const supabase = createAdminClient();

  const [{ data: metrics }, { data: estimation }] = await Promise.all([
    supabase
      .from('job_metrics')
      .select(
        'minutes_par_m2, facture_htva, duree_reelle_min, couverture_photo, retouches, avis_note, checklist_suspecte',
      )
      .eq('complet', true),
    supabase.from('stats_estimation').select('*').maybeSingle(),
  ]);

  const lignes = metrics ?? [];
  const n = lignes.length;

  if (n === 0) {
    return {
      chantiersComplets: 0,
      medianeMinutesM2: null,
      caHoraire: null,
      precisionEstimation: null,
      ecartFacturationMoyen: null,
      couverturePhoto: null,
      tauxRetouche: null,
      noteMoyenne: null,
      checklistsSuspectes: 0,
      confiance: 'aucune',
    };
  }

  const mediane = (valeurs: number[]): number | null => {
    const tri = valeurs.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (tri.length === 0) return null;
    const i = (tri.length - 1) / 2;
    return (tri[Math.floor(i)]! + tri[Math.ceil(i)]!) / 2;
  };

  const moyenne = (valeurs: (number | null)[]): number | null => {
    const v = valeurs.filter((x): x is number => x !== null && Number.isFinite(x));
    return v.length === 0 ? null : v.reduce((s, x) => s + x, 0) / v.length;
  };

  const caHoraires = lignes
    .filter((l) => l.facture_htva && l.duree_reelle_min)
    .map((l) => (Number(l.facture_htva) / Number(l.duree_reelle_min)) * 60);

  const { niveauDepuisN } = await import('@/lib/intelligence');

  return {
    chantiersComplets: n,
    medianeMinutesM2: mediane(lignes.map((l) => Number(l.minutes_par_m2))),
    caHoraire: mediane(caHoraires),
    precisionEstimation:
      estimation?.precision_pct !== undefined && estimation.precision_pct !== null
        ? Number(estimation.precision_pct)
        : null,
    ecartFacturationMoyen:
      estimation?.ecart_facturation_moyen !== undefined &&
      estimation.ecart_facturation_moyen !== null
        ? Number(estimation.ecart_facturation_moyen)
        : null,
    couverturePhoto: moyenne(
      lignes.map((l) => (l.couverture_photo !== null ? Number(l.couverture_photo) : null)),
    ),
    tauxRetouche: (lignes.filter((l) => Number(l.retouches) > 0).length * 100) / n,
    noteMoyenne: moyenne(
      lignes.map((l) => (l.avis_note !== null ? Number(l.avis_note) : null)),
    ),
    checklistsSuspectes: lignes.filter((l) => l.checklist_suspecte).length,
    confiance: niveauDepuisN(n),
  };
}

/* ==========================================================================
 * Base de connaissances
 * ==========================================================================
 * Cinq questions que le dirigeant se pose reellement. Chaque reponse porte
 * son nombre d'observations : une reponse sans son assise est une opinion.
 * ======================================================================== */

export interface Reponse<T> {
  valeur: T | null;
  n: number;
  confiance: NiveauConfiance;
  phrase: string;
}

async function confianceDe(n: number): Promise<NiveauConfiance> {
  const { niveauDepuisN } = await import('@/lib/intelligence');
  return niveauDepuisN(n);
}

export async function combienDeTempsChantierSimilaire(params: {
  propertyType: PropertyType;
  surface: number;
  soil: SoilLevel;
}): Promise<Reponse<{ minutes: number; minutesParM2: number }>> {
  const ref = await referenceEffective(params.propertyType, params.surface, params.soil);
  const minutes = Math.round(ref.minutesParM2 * params.surface);

  return {
    valeur: { minutes, minutesParM2: ref.minutesParM2 },
    n: ref.n,
    confiance: ref.confiance,
    phrase:
      ref.origine === 'catalogue'
        ? `Environ ${Math.round(minutes / 60)} h selon le catalogue — aucun chantier comparable réalisé pour l'instant.`
        : `Environ ${Math.round(minutes / 60)} h, médiane sur ${ref.n} chantiers comparables.`,
  };
}

export async function quelleMargeMoyenne(): Promise<Reponse<{ caHoraire: number }>> {
  const ind = await indicateurs();

  if (ind.caHoraire === null) {
    return {
      valeur: null,
      n: ind.chantiersComplets,
      confiance: 'aucune',
      phrase: 'Aucun chantier facturé : la question n’a pas encore de réponse.',
    };
  }

  return {
    valeur: { caHoraire: ind.caHoraire },
    n: ind.chantiersComplets,
    confiance: ind.confiance,
    phrase: `${ind.caHoraire.toFixed(0)} € HTVA par heure travaillée, médiane sur ${ind.chantiersComplets} chantier${ind.chantiersComplets > 1 ? 's' : ''}.`,
  };
}

export async function quelleEquipeLaPlusEfficace(): Promise<
  Reponse<{ equipe: string; medianeMinM2: number }>
> {
  const { data } = await createAdminClient()
    .from('stats_par_equipe')
    .select('*')
    .order('mediane_min_m2');

  const lignes = data ?? [];
  // Sous 5 chantiers, comparer deux equipes n'a pas de sens : l'ecart tient
  // au hasard des chantiers attribues, pas a l'efficacite.
  const eligibles = lignes.filter((l) => Number(l.chantiers) >= 5);

  if (eligibles.length < 2) {
    return {
      valeur: null,
      n: lignes.length,
      confiance: 'aucune',
      phrase:
        'Comparaison impossible : il faut au moins deux équipes avec cinq chantiers chacune, sinon l’écart tient au hasard des chantiers attribués.',
    };
  }

  const meilleure = eligibles[0]!;
  return {
    valeur: {
      equipe: String(meilleure.equipe),
      medianeMinM2: Number(meilleure.mediane_min_m2),
    },
    n: Number(meilleure.chantiers),
    confiance: await confianceDe(Number(meilleure.chantiers)),
    phrase: `${meilleure.equipe} — ${Number(meilleure.mediane_min_m2).toFixed(1)} min/m² sur ${meilleure.chantiers} chantiers.`,
  };
}

export async function quelleCommuneLaPlusRentable(): Promise<
  Reponse<{ commune: string; caHoraire: number }>
> {
  const { data } = await createAdminClient()
    .from('stats_par_commune')
    .select('*')
    .order('ca_horaire', { ascending: false });

  const eligibles = (data ?? []).filter(
    (l) => Number(l.chantiers) >= 3 && l.ca_horaire !== null,
  );

  if (eligibles.length === 0) {
    return {
      valeur: null,
      n: (data ?? []).length,
      confiance: 'aucune',
      phrase: 'Aucune commune n’atteint trois chantiers facturés — trop tôt pour classer.',
    };
  }

  const top = eligibles[0]!;
  return {
    valeur: { commune: String(top.commune), caHoraire: Number(top.ca_horaire) },
    n: Number(top.chantiers),
    confiance: await confianceDe(Number(top.chantiers)),
    phrase: `${top.commune} — ${Number(top.ca_horaire).toFixed(0)} €/h sur ${top.chantiers} chantiers.`,
  };
}

export async function quelTypeGenereLePlusDeRecommandations(): Promise<
  Reponse<{ service: string; tauxRecurrence: number }>
> {
  const { data } = await createAdminClient()
    .from('job_metrics')
    .select('service, chantier_rang, avis_depose')
    .eq('complet', true);

  const lignes = data ?? [];
  if (lignes.length < 5) {
    return {
      valeur: null,
      n: lignes.length,
      confiance: 'aucune',
      phrase: `${lignes.length} chantier${lignes.length > 1 ? 's' : ''} terminé${lignes.length > 1 ? 's' : ''} : il en faut au moins cinq pour distinguer une tendance d'un hasard.`,
    };
  }

  const parService = new Map<string, { total: number; recurrents: number }>();
  for (const l of lignes) {
    const e = parService.get(l.service) ?? { total: 0, recurrents: 0 };
    e.total += 1;
    if (Number(l.chantier_rang) > 1) e.recurrents += 1;
    parService.set(l.service, e);
  }

  const classement = Array.from(parService.entries())
    .map(([service, v]) => ({ service, taux: (v.recurrents * 100) / v.total, total: v.total }))
    .sort((a, b) => b.taux - a.taux);

  const top = classement[0]!;
  return {
    valeur: { service: top.service, tauxRecurrence: Math.round(top.taux) },
    n: top.total,
    confiance: await confianceDe(top.total),
    phrase: `${top.service} — ${Math.round(top.taux)} % de clients revenus, sur ${top.total} chantiers.`,
  };
}

/* ==========================================================================
 * Cockpit
 * ==========================================================================
 * Toutes les lectures du tableau de bord passent par ici. Aucune agregation
 * cote front : les vues SQL font le calcul, ce module ne fait que transporter.
 * ======================================================================== */

export interface PerfGlobale {
  n: number;
  nPrecedent: number;
  cadence: number | null;
  cadencePrecedente: number | null;
  caHoraire: number | null;
  caHorairePrecedent: number | null;
  precision: number | null;
  precisionPrecedente: number | null;
  tauxRetouche: number | null;
  tauxRetouchePrecedent: number | null;
  couverture: number | null;
  couverturePrecedente: number | null;
  note: number | null;
  notePrecedente: number | null;
  delaiSignatureH: number | null;
  delaiSignaturePrecedent: number | null;
  delaiPaiementJ: number | null;
  delaiPaiementPrecedent: number | null;
}

const nb = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export async function perfGlobale(): Promise<PerfGlobale> {
  const { data } = await createAdminClient().from('perf_globale').select('*').maybeSingle();

  return {
    n: Number(data?.n ?? 0),
    nPrecedent: Number(data?.n_precedent ?? 0),
    cadence: nb(data?.cadence),
    cadencePrecedente: nb(data?.cadence_precedente),
    caHoraire: nb(data?.ca_horaire),
    caHorairePrecedent: nb(data?.ca_horaire_precedent),
    precision: nb(data?.precision_pct),
    precisionPrecedente: nb(data?.precision_precedente),
    tauxRetouche: nb(data?.taux_retouche),
    tauxRetouchePrecedent: nb(data?.taux_retouche_precedent),
    couverture: nb(data?.couverture),
    couverturePrecedente: nb(data?.couverture_precedente),
    note: nb(data?.note),
    notePrecedente: nb(data?.note_precedente),
    delaiSignatureH: nb(data?.delai_signature_h),
    delaiSignaturePrecedent: nb(data?.delai_signature_precedent),
    delaiPaiementJ: nb(data?.delai_paiement_j),
    delaiPaiementPrecedent: nb(data?.delai_paiement_precedent),
  };
}

/** Alertes actionnables. Les seuils vivent dans `lib/alertes`, pas ici. */
export async function alertes(): Promise<Alerte[]> {
  const supabase = createAdminClient();

  const [ecarts, rendements, retouches, communes, ind] = await Promise.all([
    supabase.from('ecart_tarifaire').select('*'),
    supabase.from('rendement_par_effectif').select('*'),
    supabase.from('retouches_par_service').select('*'),
    supabase.from('opportunites_communes').select('*'),
    indicateurs(),
  ]);

  const entrees: EntreesAlertes = {
    ecarts: (ecarts.data ?? []) as EntreesAlertes['ecarts'],
    rendements: (rendements.data ?? []) as EntreesAlertes['rendements'],
    retouches: (retouches.data ?? []) as EntreesAlertes['retouches'],
    communes: (communes.data ?? []) as EntreesAlertes['communes'],
    caHoraireGlobal: ind.caHoraire,
    precisionEstimation: ind.precisionEstimation,
    couvertureMoyenne: ind.couverturePhoto,
    checklistsSuspectes: ind.checklistsSuspectes,
    chantiersComplets: ind.chantiersComplets,
  };

  return produireAlertes(entrees);
}

export async function chantiersComparables(
  propertyType: PropertyType,
  surface: number,
  soil: SoilLevel,
) {
  const { data } = await createAdminClient().rpc('chantiers_comparables', {
    p_property_type: propertyType,
    p_surface: surface,
    p_soil: soil,
    p_limite: 20,
  });
  return data ?? [];
}

/* ==========================================================================
 * SUITON Intelligence
 * ======================================================================== */

export async function recommandations(): Promise<Recommandation[]> {
  const supabase = createAdminClient();

  const [volumes, rendements, communes, retouches, etapes, ind, rejetees] = await Promise.all([
    supabase.from('volume_par_segment').select('*'),
    supabase.from('rendement_par_effectif').select('*'),
    supabase.from('opportunites_communes').select('*'),
    supabase.from('retouches_par_service').select('*'),
    supabase.from('stats_par_etape').select('*'),
    indicateurs(),
    supabase.from('recommandations').select('code').eq('statut', 'rejetee'),
  ]);

  const entrees: EntreesRecommandations = {
    volumes: (volumes.data ?? []) as EntreesRecommandations['volumes'],
    rendements: (rendements.data ?? []) as EntreesRecommandations['rendements'],
    communes: (communes.data ?? []) as EntreesRecommandations['communes'],
    retouches: (retouches.data ?? []) as EntreesRecommandations['retouches'],
    etapes: (etapes.data ?? []) as EntreesRecommandations['etapes'],
    caHoraireGlobal: ind.caHoraire,
    chantiersComplets: ind.chantiersComplets,
    codesRejetes: (rejetees.data ?? []).map((r) => String(r.code)),
  };

  return produireRecommandations(entrees);
}

export interface ExperienceAvecMesure {
  id: string;
  titre: string;
  hypothese: string;
  famille: string;
  statut: string;
  indicateur: string;
  testDebut: string;
  testFin: string | null;
  resultat: ResultatExperience;
}

/** Charge les expériences et les mesure. La mesure est toujours recalculée. */
export async function experiences(): Promise<ExperienceAvecMesure[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('experiences')
    .select('*')
    .in('statut', ['en_cours', 'terminee'])
    .order('test_debut', { ascending: false });

  const vide = { n: 0, mediane: null, q1: null, q3: null };

  return Promise.all(
    (data ?? []).map(async (e) => {
      const { data: mesures } = await supabase.rpc('mesurer_experience', {
        p_experience_id: e.id,
      });

      const lignes = (mesures ?? []) as {
        periode: string;
        n: number;
        mediane: number | null;
        q1: number | null;
        q3: number | null;
      }[];

      const prendre = (periode: string) => {
        const l = lignes.find((x) => x.periode === periode);
        return l
          ? {
              n: Number(l.n),
              mediane: l.mediane !== null ? Number(l.mediane) : null,
              q1: l.q1 !== null ? Number(l.q1) : null,
              q3: l.q3 !== null ? Number(l.q3) : null,
            }
          : vide;
      };

      return {
        id: String(e.id),
        titre: String(e.titre),
        hypothese: String(e.hypothese),
        famille: String(e.famille),
        statut: String(e.statut),
        indicateur: String(e.indicateur),
        testDebut: String(e.test_debut),
        testFin: e.test_fin ? String(e.test_fin) : null,
        resultat: analyserExperience({
          reference: prendre('reference'),
          test: prendre('test'),
          indicateur: String(e.indicateur),
        }),
      };
    }),
  );
}

/* ==========================================================================
 * Playbook
 * ======================================================================== */

export interface PlanAvecContexte {
  recommandation: Recommandation;
  plan: Plan;
  /** Chantiers comparables, pour ouvrir le dossier derrière la décision. */
  comparables: Record<string, unknown>[];
}

/**
 * Construit le plan d'execution d'une recommandation, avec son dossier.
 *
 * « Ouvre automatiquement les chantiers comparables » : le dirigeant doit
 * pouvoir verifier la recommandation sur pieces avant de l'accepter.
 */
export async function planPour(code: string): Promise<PlanAvecContexte | null> {
  const supabase = createAdminClient();

  const [recos, { data: modeles }] = await Promise.all([
    recommandations(),
    supabase.from('playbook_modeles').select('*').eq('actif', true),
  ]);

  const reco = recos.find((r) => r.code === code);
  if (!reco) return null;

  const liste = (modeles ?? []) as unknown as ModelePlaybook[];
  const modele = modelePour(reco.famille, liste);
  if (!modele) return null;

  // Rythme observé sur le périmètre, pour savoir si le test peut conclure.
  const { data: volumes } = await supabase.from('volume_par_segment').select('*');

  const segments = (volumes ?? []) as {
    chantiers: number;
    jours_couverts: number;
    property_type: string;
    bande: string;
    soil: string;
  }[];

  // Le code d'une recommandation tarifaire porte son périmètre :
  // tarif:service:bien:bande:salissure
  const parties = code.split(':');
  const cible = segments.find(
    (s) => s.property_type === parties[2] && s.bande === parties[3] && s.soil === parties[4],
  );

  const chantiersParMois = cible
    ? (cible.chantiers / Math.max(1, cible.jours_couverts)) * 30
    : 0;

  const comparables =
    parties[2] && parties[4]
      ? await chantiersComparables(
          parties[2] as PropertyType,
          parties[3] === 'xs'
            ? 40
            : parties[3] === 's'
              ? 90
              : parties[3] === 'm'
                ? 140
                : parties[3] === 'l'
                  ? 250
                  : 400,
          parties[4] as SoilLevel,
        )
      : [];

  return {
    recommandation: reco,
    plan: construirePlan({ recommandation: reco, modele, chantiersParMois }),
    comparables: comparables as Record<string, unknown>[],
  };
}

export async function modelesPlaybook(): Promise<ModelePlaybook[]> {
  const { data } = await createAdminClient()
    .from('playbook_modeles')
    .select('*')
    .eq('actif', true)
    .order('famille');
  return (data ?? []) as unknown as ModelePlaybook[];
}

export interface BilanAnnuel extends BilanValeur {
  recits: string[];
}

/** Bilan de l'année : ce que SUITON Intelligence a changé. */
export async function bilanAnnuel(annee: number): Promise<BilanAnnuel> {
  const supabase = createAdminClient();
  const debut = `${annee}-01-01`;

  const [{ data: valeur }, { data: decisions }, { data: memoire }] = await Promise.all([
    supabase.from('valeur_creee').select('*').eq('annee', debut).maybeSingle(),
    supabase.from('decisions_par_annee').select('*').eq('annee', debut).maybeSingle(),
    supabase.from('memoire_entreprise').select('*').limit(20),
  ]);

  const bilan = composerBilan({
    annee,
    generalisees: Number(valeur?.generalisees ?? 0),
    arretees: Number(valeur?.arretees ?? 0),
    prolongees: Number(valeur?.prolongees ?? 0),
    acceptees: Number(decisions?.acceptees ?? 0),
    ecartees: Number(decisions?.rejetees ?? 0),
    valeurAnnuelle: Number(valeur?.valeur_annuelle ?? 0),
  });

  const recits = (memoire ?? [])
    .filter((m) => String(m.test_debut).startsWith(String(annee)))
    .map((m) =>
      raconter({
        titre: String(m.titre),
        perimetre: m.perimetre ? String(m.perimetre) : null,
        intervention: m.intervention ? String(m.intervention) : null,
        testDebut: String(m.test_debut),
        testFin: m.test_fin ? String(m.test_fin) : null,
        decision: String(m.decision) as DecisionFinale,
        conclusion: m.conclusion ? String(m.conclusion) : null,
        valeurAnnuelle: m.valeur_annuelle !== null ? Number(m.valeur_annuelle) : null,
      }),
    );

  return { ...bilan, recits };
}
