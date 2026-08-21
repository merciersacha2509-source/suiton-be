import type { Metadata } from 'next';
import { requireCapability } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/roles';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SettingsForm } from './settings-form';
import type { SettingsRow } from '@/types/database';

export const metadata: Metadata = { title: 'Paramètres' };
export const dynamic = 'force-dynamic';

export default async function ParametresPage() {
  const session = await requireCapability('settings.read');
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle<SettingsRow>();

  if (!settings) {
    return (
      <>
        <PageHeader titre="Paramètres" />
        <Alert ton="danger" titre="Réglages absents">
          La ligne <code>settings</code> n&apos;existe pas. Appliquez les migrations :{' '}
          <code className="rounded bg-white px-1">supabase db reset</code>.
        </Alert>
      </>
    );
  }

  const modifiable = can(session.profile.role, 'settings.write');

  return (
    <>
      <PageHeader
        titre="Paramètres"
        description="La grille tarifaire vit ici et nulle part ailleurs dans le code."
      />

      {!modifiable ? (
        <div className="flex flex-col gap-5">
          <Alert ton="alerte" titre="Lecture seule">
            Seule la direction peut modifier la grille tarifaire.
          </Alert>
          <Card>
            <CardHeader titre="Entreprise" />
            <CardBody className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-ardoise">TVA</span> · {settings.entreprise.tva}
              </p>
              <p>
                <span className="text-ardoise">Peppol</span> · {settings.entreprise.peppol}
              </p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </>
  );
}
