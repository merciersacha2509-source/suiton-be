import type { Metadata } from 'next';
import { BookingWizard } from './wizard';
import { Alert } from '@/components/ui/alert';
import { grillePublique, GRILLE_REPLI } from '@/lib/site/tarifs';
import { metadonnees } from '@/lib/site/seo';
import { FilAriane } from '@/components/site/blocs';
import type { ServiceType, SoilLevel, PropertyType } from '@/types/database';

export const metadata: Metadata = metadonnees({
  title: 'Demander un devis de nettoyage de fin de chantier',
  description:
    'Décrivez votre chantier en deux minutes et recevez un devis ferme sous 24 heures ouvrées. ' +
    'Estimation immédiate, vitres comprises, rapport photo systématique.',
  chemin: '/reservation',
});

export const dynamic = 'force-dynamic';

const SERVICES_VALIDES: ServiceType[] = ['fin_de_chantier', 'apres_renovation', 'vitres'];
const SALISSURES_VALIDES: SoilLevel[] = ['leger', 'standard', 'lourd'];
const BIENS_VALIDES: PropertyType[] = [
  'studio',
  'appartement',
  'maison',
  'villa',
  'bureaux',
  'commerce',
  'autre',
];

/**
 * Parcours de demande de devis.
 *
 * Les parametres de requete pre-remplissent le formulaire quand le visiteur
 * arrive depuis le calculateur : il ne resaisit pas ce qu'il vient de
 * renseigner. Toute valeur inattendue est ignoree — un parametre d'URL est
 * une donnee entrante, jamais une instruction.
 */
export default async function ReservationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [settings, params] = await Promise.all([grillePublique(), searchParams]);

  const lire = (cle: string) => {
    const v = params[cle];
    return typeof v === 'string' ? v : undefined;
  };

  const service = lire('service');
  const salissure = lire('salissure');
  const surfaceBrute = Number(lire('surface'));

  const prefill = {
    service: SERVICES_VALIDES.includes(service as ServiceType)
      ? (service as ServiceType)
      : undefined,
    soil: SALISSURES_VALIDES.includes(salissure as SoilLevel)
      ? (salissure as SoilLevel)
      : undefined,
    surface_m2:
      Number.isFinite(surfaceBrute) && surfaceBrute >= 10 && surfaceBrute <= 5000
        ? Math.round(surfaceBrute)
        : undefined,
    code_postal: /^\d{4}$/.test(lire('cp') ?? '') ? lire('cp') : undefined,
    property_type: BIENS_VALIDES.includes(lire('bien') as PropertyType)
      ? (lire('bien') as PropertyType)
      : undefined,
    urgent: lire('urgent') === '1' ? true : undefined,
  };

  if (settings === GRILLE_REPLI) {
    // Repli silencieux : la grille de secours est celle du catalogue. Le
    // visiteur voit une estimation, et le devis sera recalcule cote serveur.
  }

  return (
    <>
      <FilAriane
        items={[
          { nom: 'Accueil', href: '/' },
          { nom: 'Demander un devis', href: '/reservation' },
        ]}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        {settings.prix_m2 ? (
          <BookingWizard settings={settings} prefill={prefill} />
        ) : (
          <Alert ton="danger" titre="Service momentanément indisponible">
            Impossible de charger la grille tarifaire. Appelez le 0489 21 01 24 — nous prenons
            votre demande par téléphone.
          </Alert>
        )}
      </div>
    </>
  );
}
