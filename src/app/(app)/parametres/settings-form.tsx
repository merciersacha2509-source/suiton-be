'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { estimate } from '@/lib/pricing';
import { formatRange } from '@/lib/format';
import { updateSettingsAction, type SettingsState } from './actions';
import type { SettingsRow, ServiceType, SoilLevel } from '@/types/database';

const SERVICES: { code: ServiceType; label: string }[] = [
  { code: 'fin_de_chantier', label: 'Fin de chantier' },
  { code: 'apres_renovation', label: 'Après rénovation' },
  { code: 'vitres', label: 'Vitres' },
];

const NIVEAUX: { code: SoilLevel; label: string }[] = [
  { code: 'leger', label: 'Léger' },
  { code: 'standard', label: 'Standard' },
  { code: 'lourd', label: 'Lourd' },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer la grille'}
    </Button>
  );
}

export function SettingsForm({ settings }: { settings: SettingsRow }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(updateSettingsAction, {});

  // Copie locale pour l'apercu : le calcul affiche doit refleter ce que
  // l'utilisateur est en train de taper, pas ce qui est enregistre.
  const [brouillon, setBrouillon] = useState(settings);

  const apercu = useMemo(() => {
    try {
      return estimate(
        {
          service: 'fin_de_chantier',
          soil: 'standard',
          surface_m2: 140,
          zone: 'principale',
          urgent: false,
        },
        brouillon,
      );
    } catch {
      return null;
    }
  }, [brouillon]);

  function majPrix(
    service: ServiceType,
    niveau: SoilLevel,
    borne: 'min' | 'max',
    valeur: number,
  ) {
    setBrouillon((prev) => ({
      ...prev,
      prix_m2: {
        ...prev.prix_m2,
        [service]: {
          ...prev.prix_m2[service],
          [niveau]: { ...prev.prix_m2[service][niveau], [borne]: valeur },
        },
      },
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.ok ? (
        <Alert ton="succes">Grille enregistrée. La modification est journalisée.</Alert>
      ) : null}
      {state.error ? (
        <Alert ton="danger" titre={state.error}>
          {state.issues?.length ? (
            <ul className="mt-1 list-disc pl-4">
              {state.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          titre="Prix au m² (HTVA)"
          description="Source unique du calculateur, de l'estimation et du devis"
        />
        <CardBody className="flex flex-col gap-5">
          {SERVICES.map((service) => (
            <fieldset key={service.code} className="border-0 p-0">
              <legend className="mb-2 text-[0.8125rem] font-semibold">{service.label}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {NIVEAUX.map((niveau) => (
                  <div key={niveau.code} className="grid grid-cols-2 gap-2">
                    <Field label={`${niveau.label} min`}>
                      {(p) => (
                        <Input
                          {...p}
                          name={`${service.code}.${niveau.code}.min`}
                          type="number"
                          step="0.5"
                          min="0.5"
                          inputMode="decimal"
                          defaultValue={settings.prix_m2[service.code][niveau.code].min}
                          onChange={(e) =>
                            majPrix(service.code, niveau.code, 'min', Number(e.target.value))
                          }
                        />
                      )}
                    </Field>
                    <Field label="max">
                      {(p) => (
                        <Input
                          {...p}
                          name={`${service.code}.${niveau.code}.max`}
                          type="number"
                          step="0.5"
                          min="0.5"
                          inputMode="decimal"
                          defaultValue={settings.prix_m2[service.code][niveau.code].max}
                          onChange={(e) =>
                            majPrix(service.code, niveau.code, 'max', Number(e.target.value))
                          }
                        />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          {apercu ? (
            <Alert
              ton="info"
              titre="Aperçu — maison 140 m², salissure standard, zone principale"
            >
              <span className="tabular font-semibold">
                {formatRange(apercu.min, apercu.max)}
              </span>{' '}
              HTVA
            </Alert>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titre="Coefficients par type de bien"
          description="1,00 = sans effet. Un studio de 80 m² et une villa de 80 m² ne demandent pas le même travail : nombre de sanitaires, escaliers, surface vitrée. Ajustez seulement quand vos chantiers réels le justifient — le système ne touchera jamais à ces valeurs."
        />
        <CardBody className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(
            [
              'studio',
              'appartement',
              'maison',
              'villa',
              'bureaux',
              'commerce',
              'autre',
            ] as const
          ).map((bien) => (
            <Field key={bien} label={bien.charAt(0).toUpperCase() + bien.slice(1)}>
              {(p) => (
                <Input
                  {...p}
                  name={`coef.${bien}`}
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="2"
                  inputMode="decimal"
                  defaultValue={settings.coef_bien?.[bien] ?? 1}
                />
              )}
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titre="Zones" description="Frais de déplacement forfaitaires" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {(['principale', 'secondaire', 'exceptionnelle'] as const).map((zone) => (
            <div key={zone} className="flex flex-col gap-2">
              <Field label={`${zone} — frais (€)`}>
                {(p) => (
                  <Input
                    {...p}
                    name={`zone.${zone}.frais`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    defaultValue={settings.zones[zone].frais}
                  />
                )}
              </Field>
              <Field label="Libellé">
                {(p) => (
                  <Input
                    {...p}
                    name={`zone.${zone}.libelle`}
                    defaultValue={settings.zones[zone].libelle}
                  />
                )}
              </Field>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titre="Règles" description="Majoration, seuils et délais" />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Majoration urgence (%)">
            {(p) => (
              <Input
                {...p}
                name="majoration_urgence"
                type="number"
                min="0"
                max="100"
                step="1"
                inputMode="numeric"
                defaultValue={Math.round(settings.majoration_urgence * 100)}
              />
            )}
          </Field>
          <Field label="TVA (%)">
            {(p) => (
              <Input
                {...p}
                name="tva_taux"
                type="number"
                min="0"
                max="30"
                step="0.5"
                inputMode="decimal"
                defaultValue={Number((settings.tva_taux * 100).toFixed(1))}
              />
            )}
          </Field>
          <Field
            label="Seuil sur devis (m²)"
            hint="Au-delà, estimation remplacée par un devis sur mesure"
          >
            {(p) => (
              <Input
                {...p}
                name="seuil_surface_devis"
                type="number"
                min="50"
                inputMode="numeric"
                defaultValue={settings.seuil_surface_devis}
              />
            )}
          </Field>
          <Field label="Délai de devis (h)">
            {(p) => (
              <Input
                {...p}
                name="delai_devis_heures"
                type="number"
                min="1"
                defaultValue={settings.delai_devis_heures}
              />
            )}
          </Field>
          <Field label="Garantie retouche (h)">
            {(p) => (
              <Input
                {...p}
                name="garantie_heures"
                type="number"
                min="0"
                defaultValue={settings.garantie_heures}
              />
            )}
          </Field>
          <Field
            label="Tampon de trajet (min)"
            hint="Bloqué au calendrier autour de chaque intervention"
          >
            {(p) => (
              <Input
                {...p}
                name="tampon_trajet_min"
                type="number"
                min="0"
                max="240"
                defaultValue={settings.tampon_trajet_min}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}
