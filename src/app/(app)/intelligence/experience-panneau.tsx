'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Confiance } from '@/components/ui/confiance';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import {
  cloturerExperienceAction,
  lancerExperienceAction,
  type DecisionState,
} from './actions';
import type { ExperienceAvecMesure } from '@/lib/services/analytics';
import type { VerdictExperience } from '@/lib/experiences';

const VERDICTS: Record<VerdictExperience, { libelle: string; classe: string }> = {
  positif: { libelle: 'Concluant', classe: 'bg-succes-wash text-succes border-succes/25' },
  negatif: { libelle: 'Négatif', classe: 'bg-danger-wash text-danger border-danger/25' },
  neutre: { libelle: 'Sans effet', classe: 'bg-mineral text-ardoise border-mineral-dark' },
  indeterminé: {
    libelle: 'Pas encore concluant',
    classe: 'bg-alerte-wash text-alerte border-alerte/25',
  },
};

function Soumettre({
  libelle,
  variant = 'primary' as const,
}: {
  libelle: string;
  variant?: 'primary' | 'secondaire';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? '…' : libelle}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */

export function LancerExperience({
  suggestion,
}: {
  suggestion?: { titre: string; hypothese: string; famille: string; dureeJours: number } | null;
}) {
  const [etat, action] = useActionState<DecisionState, FormData>(lancerExperienceAction, {});
  const [ouvert, setOuvert] = useState(false);

  if (etat.ok) {
    return <Alert ton="succes">{etat.message}</Alert>;
  }

  if (!ouvert) {
    return (
      <Button variant="secondaire" onClick={() => setOuvert(true)}>
        {suggestion ? 'Lancer cette expérience' : 'Lancer une expérience'}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

      <Field label="Ce que vous testez" required>
        {(p) => (
          <Input
            {...p}
            name="titre"
            defaultValue={suggestion?.titre}
            required
            maxLength={200}
          />
        )}
      </Field>

      <Field
        label="Hypothèse"
        required
        hint="Formulez-la de façon à pouvoir être démentie. « Ça ira mieux » ne se teste pas."
      >
        {(p) => (
          <Textarea
            {...p}
            name="hypothese"
            rows={2}
            defaultValue={suggestion?.hypothese}
            required
            maxLength={500}
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Famille">
          {(p) => (
            <Select {...p} name="famille" defaultValue={suggestion?.famille ?? 'tarification'}>
              <option value="tarification">Tarification</option>
              <option value="planning">Planning</option>
              <option value="prospection">Prospection</option>
              <option value="qualite">Qualité</option>
              <option value="productivite">Productivité</option>
            </Select>
          )}
        </Field>

        <Field label="Indicateur observé">
          {(p) => (
            <Select {...p} name="indicateur" defaultValue="ca_horaire">
              <option value="ca_horaire">CA horaire</option>
              <option value="facture_htva">Panier moyen</option>
              <option value="minutes_par_m2">Cadence (min/m²)</option>
              <option value="couverture_photo">Couverture photo</option>
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Service" hint="Vide = tous">
          {(p) => (
            <Select {...p} name="service" defaultValue="">
              <option value="">Tous</option>
              <option value="fin_de_chantier">Fin de chantier</option>
              <option value="apres_renovation">Après rénovation</option>
              <option value="vitres">Vitres</option>
            </Select>
          )}
        </Field>

        <Field label="Type de bien" hint="Vide = tous">
          {(p) => (
            <Select {...p} name="propertyType" defaultValue="">
              <option value="">Tous</option>
              <option value="studio">Studio</option>
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
              <option value="villa">Villa</option>
              <option value="bureaux">Bureaux</option>
              <option value="commerce">Commerce</option>
            </Select>
          )}
        </Field>

        <Field label="Durée (jours)">
          {(p) => (
            <Input
              {...p}
              name="dureeJours"
              type="number"
              min={30}
              max={365}
              defaultValue={suggestion?.dureeJours ?? 60}
            />
          )}
        </Field>
      </div>

      <p className="text-ardoise text-[0.75rem] leading-relaxed">
        La période de référence sera prise juste avant, sur la même durée. Comparer trois mois
        d&apos;hiver à six mois d&apos;été mesurerait la saison, pas votre expérience.
      </p>

      <div className="flex gap-2">
        <Soumettre libelle="Lancer" />
        <Button variant="discret" size="sm" onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function CarteExperience({ experience }: { experience: ExperienceAvecMesure }) {
  const [etat, action] = useActionState<DecisionState, FormData>(cloturerExperienceAction, {});
  const [clotureOuverte, setClotureOuverte] = useState(false);
  const r = experience.resultat;
  const v = VERDICTS[r.verdict];

  return (
    <Card>
      <CardHeader
        titre={experience.titre}
        description={`Depuis le ${formatDate(experience.testDebut)}`}
        action={
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium',
              v.classe,
            )}
          >
            {v.libelle}
          </span>
        }
      />
      <CardBody className="flex flex-col gap-3.5">
        <p className="text-ardoise text-[0.8125rem] italic">« {experience.hypothese} »</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { titre: 'Avant', e: r.reference },
            { titre: 'Pendant', e: r.test },
          ].map((c) => (
            <div key={c.titre} className="rounded-suiton bg-mineral px-3 py-2.5">
              <p className="text-ardoise text-[0.6875rem] tracking-wide uppercase">{c.titre}</p>
              <p className="tabular font-heading mt-1 text-lg font-semibold">
                {c.e.mediane !== null ? c.e.mediane.toLocaleString('fr-BE') : '—'}
              </p>
              <p className="tabular text-ardoise text-[0.75rem]">
                {c.e.n} chantier{c.e.n > 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm leading-snug font-medium">{r.conclusion}</p>
          <p className="text-ardoise mt-1 text-[0.8125rem]">{r.suite}</p>
        </div>

        {r.reserves.length > 0 ? (
          <div className="rounded-suiton bg-alerte-wash px-3 py-2.5">
            <p className="text-alerte mb-1 text-[0.6875rem] font-semibold tracking-wide uppercase">
              Réserves
            </p>
            {r.reserves.map((res) => (
              <p key={res} className="text-[0.8125rem] leading-relaxed">
                {res}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Confiance niveau={r.confiance} n={Math.min(r.reference.n, r.test.n)} />
          {experience.statut === 'en_cours' && !clotureOuverte ? (
            <button
              type="button"
              onClick={() => setClotureOuverte(true)}
              className="text-ocean ml-auto text-[0.8125rem] underline-offset-2 hover:underline"
            >
              Clôturer
            </button>
          ) : null}
        </div>

        {etat.ok ? <Alert ton="succes">{etat.message}</Alert> : null}
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

        {clotureOuverte && !etat.ok ? (
          <form
            action={action}
            className="border-mineral-dark flex flex-col gap-2.5 border-t pt-3"
          >
            <input type="hidden" name="id" value={experience.id} />
            <Field label="Ce que vous retenez" required>
              {(p) => <Textarea {...p} name="conclusion" rows={2} required maxLength={500} />}
            </Field>
            <div className="flex gap-2">
              <Soumettre libelle="Clôturer" variant="secondaire" />
              <Button variant="discret" size="sm" onClick={() => setClotureOuverte(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
