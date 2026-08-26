import { z } from 'zod';

/** Une bande de prix au m². max >= min : sans cette regle, l'estimation
 *  affiche une fourchette inversee et le devis part avec un montant faux. */
const bandeSchema = z
  .object({
    min: z.number().min(0.5).max(100),
    max: z.number().min(0.5).max(100),
  })
  .refine((b) => b.max >= b.min, {
    message: 'Le prix maximum doit etre superieur ou egal au minimum',
    path: ['max'],
  });

const niveauxSchema = z.object({
  standard: bandeSchema,
  lourd: bandeSchema,
});

const coefSchema = z.number().min(0.5).max(2);

export const settingsUpdateSchema = z.object({
  prix_m2: z.object({
    fin_de_chantier: niveauxSchema,
    // Vitres n'est plus affiche/calcule automatiquement sur le site public
    // (devis uniquement apres visite), mais l'equipe garde une grille de
    // reference interne pour chiffrer sur place.
    vitres: niveauxSchema,
  }),
  zones: z.object({
    principale: z.object({ frais: z.number().min(0).max(2000), libelle: z.string().max(80) }),
    secondaire: z.object({ frais: z.number().min(0).max(2000), libelle: z.string().max(80) }),
    exceptionnelle: z.object({
      frais: z.number().min(0).max(5000),
      libelle: z.string().max(80),
    }),
  }),
  /**
   * Coefficients par type de bien. Bornes 0,5 – 2,0, comme la contrainte en
   * base : une faute de frappe dans un champ de reglages ne doit pas pouvoir
   * diviser un devis par dix.
   */
  coef_bien: z.object({
    studio: coefSchema,
    appartement: coefSchema,
    maison: coefSchema,
    villa: coefSchema,
    bureaux: coefSchema,
    commerce: coefSchema,
    autre: coefSchema,
  }),
  majoration_urgence: z.number().min(0).max(1),
  seuil_surface_devis: z.number().int().min(50).max(5000),
  tva_taux: z.number().min(0).max(0.3),
  delai_devis_heures: z.number().int().min(1).max(168),
  garantie_heures: z.number().int().min(0).max(720),
  tampon_trajet_min: z.number().int().min(0).max(240),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
