'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/input';
import { changerStatutAction, validerRapportAction, type TerrainState } from './actions';
import type { InterventionStatus } from '@/types/database';

function Action({
  libelle,
  enCours,
  variant = 'primary',
}: {
  libelle: string;
  enCours: string;
  variant?: 'primary' | 'preuve';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="lg" block disabled={pending}>
      {pending ? enCours : libelle}
    </Button>
  );
}

export function PanneauStatut({
  interventionId,
  statut,
}: {
  interventionId: string;
  statut: InterventionStatus;
}) {
  const [etat, action] = useActionState<TerrainState, FormData>(changerStatutAction, {});

  // Un seul bouton visible a la fois : sur un chantier, un ecran qui propose
  // quatre actions fait hesiter, et l'hesitation coute plus cher qu'un clic
  // supplementaire.
  const suivant =
    statut === 'confirme' || statut === 'provisoire'
      ? {
          code: 'en_route' as const,
          libelle: 'Je pars sur le chantier',
          enCours: 'Enregistrement…',
        }
      : statut === 'en_route'
        ? { code: 'sur_place' as const, libelle: 'Je suis arrivé', enCours: 'Enregistrement…' }
        : null;

  return (
    <div className="flex flex-col gap-3">
      {etat.message ? <Alert ton="succes">{etat.message}</Alert> : null}
      {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

      {suivant ? (
        <form action={action}>
          <input type="hidden" name="interventionId" value={interventionId} />
          <input type="hidden" name="statut" value={suivant.code} />
          <Action libelle={suivant.libelle} enCours={suivant.enCours} />
        </form>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function PanneauValidation({
  interventionId,
  checklistComplete,
  pairesCompletes,
  dejaValide,
}: {
  interventionId: string;
  checklistComplete: boolean;
  pairesCompletes: number;
  dejaValide: boolean;
}) {
  const [etat, action] = useActionState<TerrainState, FormData>(validerRapportAction, {});

  if (dejaValide) {
    return (
      <Alert ton="succes" titre="Rapport produit">
        Le rapport a été généré et transmis au client. La garantie retouche court.
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="interventionId" value={interventionId} />

      {etat.message ? (
        <Alert ton={etat.ok ? 'succes' : 'info'}>
          {etat.message}
          {etat.rapportUrl ? (
            <>
              {' '}
              <a
                href={etat.rapportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Ouvrir le rapport
              </a>
            </>
          ) : null}
        </Alert>
      ) : null}
      {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}

      <div>
        <label htmlFor="observations" className="text-[0.8125rem] font-medium">
          Observations <span className="text-danger">*</span>
        </label>
        <p className="text-ardoise mt-0.5 mb-1.5 text-[0.8125rem]">
          Ce champ vous protège. Un dégât préexistant signalé et photographié le jour même ne
          peut plus vous être imputé trois semaines plus tard. Si tout était normal, écrivez-le.
        </p>
        <Textarea
          id="observations"
          name="observations"
          rows={4}
          required
          minLength={3}
          maxLength={3000}
          placeholder="Rayure sur le châssis de la cuisine, antérieure à notre intervention, photographiée (paire 2). Traces de colle sur le carrelage retirées au décapant doux."
        />
      </div>

      {!checklistComplete ? (
        <Alert ton="alerte" titre="Checklist incomplète">
          Les six étapes doivent être cochées avant de produire le rapport.
        </Alert>
      ) : null}

      {pairesCompletes === 0 ? (
        <Alert ton="alerte" titre="Aucune paire avant/après">
          Le rapport sera produit sans comparaison photo. C&apos;est possible, mais c&apos;est
          précisément ce qui prouve le résultat.
        </Alert>
      ) : null}

      <Action
        libelle="Terminer et envoyer le rapport"
        enCours="Génération du rapport…"
        variant="preuve"
      />
    </form>
  );
}
