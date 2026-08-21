import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { urlSignee } from '@/lib/storage';
import type { ServiceType, PropertyType } from '@/types/database';

/**
 * Realisations publiees.
 *
 * Une realisation n'est pas une page qu'on ecrit : c'est un chantier reel
 * qu'on publie. La source est la table `jobs`, et la base impose deja qu'un
 * chantier publie ait un identifiant d'URL et un resume d'au moins
 * 80 caracteres redige a la main (contrainte `jobs_publie_a_un_resume`).
 *
 * C'est volontaire. Une galerie remplie de fiches generees a partir d'un
 * gabarit ne se positionne pas et ne convainc personne : sur un metier qui
 * vend la preuve, c'est exactement le contraire de ce qu'on cherche.
 *
 * Tant qu'aucun chantier n'est publie, cette liste est vide et la page le
 * dit. C'est le seul etat honnete avant le premier chantier.
 */

export interface PhotoPubliee {
  id: string;
  phase: 'avant' | 'apres' | 'contexte' | 'incident';
  piece: string;
  paire: number | null;
  legende: string | null;
  url: string;
  miniature: string | null;
  largeur: number | null;
  hauteur: number | null;
}

export interface Realisation {
  slug: string;
  reference: string;
  resume: string;
  service: ServiceType;
  propertyType: PropertyType;
  surface: number;
  commune: string;
  codePostal: string | null;
  publieeLe: string;
  dureeMin: number | null;
  photos: PhotoPubliee[];
  /** Paires avant/apres reconstituees, pour l'affichage en comparaison. */
  paires: { piece: string; avant: PhotoPubliee; apres: PhotoPubliee }[];
}

/**
 * Duree de validite des URL signees.
 *
 * Les pages sont regenerees toutes les heures ; une signature de 24 h laisse
 * une marge confortable meme si une regeneration echoue. Les photos restent
 * dans un bucket prive : rien n'est expose durablement.
 */
const VALIDITE_URL_S = 86_400;

interface LignePhoto {
  id: string;
  phase: PhotoPubliee['phase'];
  piece: string;
  paire: number | null;
  legende: string | null;
  storage_path: string;
  thumb_path: string | null;
  largeur: number | null;
  hauteur: number | null;
}

interface LigneJob {
  published_slug: string;
  reference: string;
  resume_public: string;
  service: ServiceType;
  property_type: PropertyType;
  surface_m2: number;
  commune: string;
  code_postal: string | null;
  published_at: string;
  duree_reelle_min: number | null;
  photos: LignePhoto[] | null;
}

const CHAMPS = `
  published_slug, reference, resume_public, service, property_type, surface_m2,
  commune, code_postal, published_at, duree_reelle_min,
  photos ( id, phase, piece, paire, legende, storage_path, thumb_path, largeur, hauteur )
`;

async function composer(ligne: LigneJob): Promise<Realisation> {
  const brutes = (ligne.photos ?? []).filter((p) => p.phase !== 'incident');

  const photos = (
    await Promise.all(
      brutes.map(async (p) => {
        const url = await urlSignee('chantiers', p.storage_path, VALIDITE_URL_S);
        if (!url) return null;
        return {
          id: p.id,
          phase: p.phase,
          piece: p.piece,
          paire: p.paire,
          legende: p.legende,
          url,
          miniature: p.thumb_path
            ? await urlSignee('chantiers', p.thumb_path, VALIDITE_URL_S)
            : null,
          largeur: p.largeur,
          hauteur: p.hauteur,
        } satisfies PhotoPubliee;
      }),
    )
  ).filter((p): p is PhotoPubliee => p !== null);

  // Une comparaison n'a de sens que si les deux moities existent. Une photo
  // « apres » sans son « avant » est jolie ; elle ne prouve rien.
  const paires: Realisation['paires'] = [];
  const parPaire = new Map<number, PhotoPubliee[]>();
  for (const p of photos) {
    if (p.paire === null) continue;
    parPaire.set(p.paire, [...(parPaire.get(p.paire) ?? []), p]);
  }
  for (const [, groupe] of [...parPaire.entries()].sort((a, b) => a[0] - b[0])) {
    const avant = groupe.find((p) => p.phase === 'avant');
    const apres = groupe.find((p) => p.phase === 'apres');
    if (avant && apres) paires.push({ piece: avant.piece, avant, apres });
  }

  return {
    slug: ligne.published_slug,
    reference: ligne.reference,
    resume: ligne.resume_public,
    service: ligne.service,
    propertyType: ligne.property_type,
    surface: ligne.surface_m2,
    commune: ligne.commune,
    codePostal: ligne.code_postal,
    publieeLe: ligne.published_at,
    dureeMin: ligne.duree_reelle_min,
    photos,
    paires,
  };
}

/** Toutes les realisations publiees, de la plus recente a la plus ancienne. */
export const realisations = cache(async (): Promise<Realisation[]> => {
  try {
    const { data } = await createAdminClient()
      .from('jobs')
      .select(CHAMPS)
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(60)
      .overrideTypes<LigneJob[]>();

    if (!data || data.length === 0) return [];
    return Promise.all(data.map(composer));
  } catch {
    // Une galerie indisponible ne doit pas faire tomber la page : elle
    // s'affiche vide, et le reste du site continue de vendre.
    return [];
  }
});

export const realisationParSlug = cache(async (slug: string): Promise<Realisation | null> => {
  try {
    const { data } = await createAdminClient()
      .from('jobs')
      .select(CHAMPS)
      .eq('published', true)
      .eq('published_slug', slug)
      .maybeSingle()
      .overrideTypes<LigneJob>();

    return data ? composer(data) : null;
  } catch {
    return null;
  }
});

/** Slugs seuls — pour generateStaticParams et le sitemap, sans signer d'URL. */
export const slugsPublies = cache(async (): Promise<{ slug: string; publieeLe: string }[]> => {
  try {
    const { data } = await createAdminClient()
      .from('jobs')
      .select('published_slug, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(200);

    return (data ?? [])
      .filter((l): l is { published_slug: string; published_at: string } =>
        Boolean(l.published_slug),
      )
      .map((l) => ({ slug: l.published_slug, publieeLe: l.published_at }));
  } catch {
    return [];
  }
});
