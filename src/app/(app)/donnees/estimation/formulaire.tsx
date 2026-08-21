'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Confiance } from '@/components/ui/confiance';
import { formatDuration, formatEUR } from '@/lib/format';
import { LIBELLES_ZONE } from '@/lib/zones';
import { estimerAction, type EstimationState } from './actions';
import type { ZoneTier } from '@/types/database';

function Soumettre() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending}>
      {pending ? 'Calcul…' : 'Estimer'}
    </Button>
  );
}

export function FormulaireEstimation() {
  const [etat, action] = useActionState<EstimationState, FormData>(estimerAction, {});
  const [techniciens, setTechniciens] = useState(1);
  const r = etat.resultat;

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader titre="Le chantier" />
        <CardBody>
          <form action={action} className="flex flex-col gap-3.5">
            <Field label="Service">
              {(p) => (
                <Select {...p} name="service" defaultValue="fin_de_chantier">
                  <option value="fin_de_chantier">Fin de chantier</option>
                  <option value="apres_renovation">Après rénovation</option>
                  <option value="vitres">Vitres</option>
                </Select>
              )}
            </Field>

            <Field label="Type de bien">
              {(p) => (
                <Select {...p} name="propertyType" defaultValue="maison">
                  <option value="studio">Studio</option>
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="villa">Villa</option>
                  <option value="bureaux">Bureaux</option>
                  <option value="commerce">Commerce</option>
                  <option value="autre">Autre</option>
                </Select>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Surface (m²)" required>
                {(p) => (
                  <Input
                    {...p}
                    name="surface"
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={5000}
                    defaultValue={140}
                    required
                  />
                )}
              </Field>
              <Field label="Code postal" required>
                {(p) => (
                  <Input
                    {...p}
                    name="codePostal"
                    inputMode="numeric"
                    maxLength={4}
                    defaultValue="1400"
                    required
                  />
                )}
              </Field>
            </div>

            <Field label="Salissure">
              {(p) => (
                <Select {...p} name="soil" defaultValue="standard">
                  <option value="leger">Légère</option>
                  <option value="standard">Standard</option>
                  <option value="lourd">Lourde</option>
                </Select>
              )}
            </Field>

            <Field
              label="Techniciens"
              hint={
                techniciens > 1
                  ? 'À plusieurs, on va plus vite — mais pas proportionnellement.'
                  : undefined
              }
            >
              {(p) => (
                <Select
                  {...p}
                  name="techniciens"
                  value={techniciens}
                  onChange={(e) => setTechniciens(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <label className="min-h-touch flex cursor-pointer items-center gap-3">
              <input type="checkbox" name="urgent" className="h-4 w-4 accent-[#0B2239]" />
              <span className="text-sm">Intervention urgente</span>
            </label>

            <Soumettre />
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-5">
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

        {!r ? (
          <Card>
            <CardBody className="py-12 text-center">
              <p className="font-heading text-base font-semibold">Renseignez le chantier</p>
              <p className="text-ardoise mx-auto mt-1.5 max-w-sm text-sm">
                Le système compare aux chantiers déjà réalisés du même gabarit. Tant qu&apos;il
                n&apos;en a pas assez, il le dit et se rabat sur la grille tarifaire.
              </p>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader
                titre="Estimation"
                description={LIBELLES_ZONE[r.zone as ZoneTier]}
                action={<Confiance niveau={r.confiance} />}
              />
              <CardBody className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-ardoise text-[0.8125rem]">Durée</p>
                    <p className="tabular font-heading mt-1 text-xl font-semibold">
                      {formatDuration(r.dureeMin)} – {formatDuration(r.dureeMax)}
                    </p>
                  </div>

                  <div>
                    <p className="text-ardoise text-[0.8125rem]">Prix recommandé</p>
                    <p className="tabular font-heading mt-1 text-xl font-semibold">
                      {r.prixMin !== null && r.prixMax !== null ? (
                        `${formatEUR(r.prixMin)} – ${formatEUR(r.prixMax)}`
                      ) : (
                        <span className="text-ardoise-clair">—</span>
                      )}
                    </p>
                    {r.prixMin === null ? (
                      <p className="text-ardoise mt-0.5 text-[0.75rem]">
                        Historique insuffisant pour recommander un prix.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-ardoise text-[0.8125rem]">CA horaire attendu</p>
                    <p className="tabular font-heading mt-1 text-xl font-semibold">
                      {r.caHoraire !== null ? (
                        `${formatEUR(r.caHoraire)}/h`
                      ) : (
                        <span className="text-ardoise-clair">—</span>
                      )}
                    </p>
                  </div>
                </div>

                <Alert ton="info">{r.explication}</Alert>

                <div className="rounded-suiton bg-mineral p-3.5">
                  <p className="text-[0.8125rem] font-medium">Grille tarifaire actuelle</p>
                  <p className="tabular mt-1 text-sm">
                    {formatEUR(r.grilleMin)} – {formatEUR(r.grilleMax)} HTVA
                  </p>
                  <p className="text-ardoise mt-1 text-[0.75rem]">
                    C&apos;est ce que le calculateur public annonce aujourd&apos;hui pour ce
                    chantier.
                  </p>
                </div>
              </CardBody>
            </Card>

            {r.alertes.length > 0 ? (
              <Card>
                <CardHeader titre="À savoir avant de chiffrer" />
                <CardBody className="flex flex-col gap-2.5">
                  {r.alertes.map((a) => (
                    <div key={a} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="bg-aqua-deep mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <p className="text-[0.8125rem] leading-relaxed">{a}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
