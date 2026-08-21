import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCapability } from '@/lib/auth/session';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { FormulaireEstimation } from './formulaire';

export const metadata: Metadata = { title: 'Estimer un chantier' };
export const dynamic = 'force-dynamic';

export default async function EstimationPage() {
  await requireCapability('quotes.write');

  return (
    <>
      <PageHeader
        titre="Estimer un chantier"
        description="Ce que l'historique dit d'un chantier avant même de le chiffrer."
        action={
          <Link href="/donnees">
            <Button variant="secondaire" size="sm">
              ← Cockpit
            </Button>
          </Link>
        }
      />
      <FormulaireEstimation />
    </>
  );
}
