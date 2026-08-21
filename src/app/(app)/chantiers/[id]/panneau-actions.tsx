'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { STAGE_LABELS } from '@/components/ui/badge';
import {
  changerEtapeAction,
  envoyerDevisAction,
  genererDevisAction,
  planifierAction,
  regenererPortailAction,
  publierRealisationAction,
  depublierRealisationAction,
  type JobActionState,
} from './actions';
import type { JobStage, QuoteStatus, TeamRow } from '@/types/database';

function Soumettre({
  libelle,
  enCours,
  variant = 'primary',
}: {
  libelle: string;
  enCours: string;
  variant?: 'primary' | 'secondaire' | 'preuve' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? enCours : libelle}
    </Button>
  );
}

function Retour({ etat }: { etat: JobActionState }) {
  if (etat.error) return <Alert ton="danger">{etat.error}</Alert>;
  if (etat.message) return <Alert ton="succes">{etat.message}</Alert>;
  return null;
}

/* -------------------------------------------------------------------------- */

export function PanneauEtape({ jobId, stage }: { jobId: string; stage: JobStage }) {
  const [etat, action] = useActionState<JobActionState, FormData>(changerEtapeAction, {});
  const [choisie, setChoisie] = useState<JobStage>(stage);

  return (
    <Card>
      <CardHeader titre="Étape" description="Position dans le pipeline commercial" />
      <CardBody className="flex flex-col gap-3">
        <Retour etat={etat} />
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="jobId" value={jobId} />
          <Field label="Nouvelle étape">
            {(p) => (
              <Select
                {...p}
                name="stage"
                value={choisie}
                onChange={(e) => setChoisie(e.target.value as JobStage)}
              >
                {(Object.keys(STAGE_LABELS) as JobStage[]).map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {choisie === 'perdu' ? (
            <Field
              label="Pourquoi ce chantier est-il perdu ?"
              required
              hint="Obligatoire. Sans motif, on refait la même erreur."
            >
              {(p) => <Textarea {...p} name="motif" rows={2} maxLength={500} required />}
            </Field>
          ) : null}

          <Soumettre
            libelle="Enregistrer l'étape"
            enCours="Enregistrement…"
            variant="secondaire"
          />
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function PanneauDevis({
  jobId,
  devis,
}: {
  jobId: string;
  devis: { id: string; numero: string; status: QuoteStatus; urlPdf: string | null } | null;
}) {
  const [gen, genererAction] = useActionState<JobActionState, FormData>(genererDevisAction, {});
  const [env, envoyerAction] = useActionState<JobActionState, FormData>(envoyerDevisAction, {});

  return (
    <Card>
      <CardHeader
        titre="Devis"
        description={devis ? `${devis.numero} · ${devis.status}` : 'Aucun devis produit'}
      />
      <CardBody className="flex flex-col gap-3">
        <Retour etat={gen} />
        <Retour etat={env} />

        {!devis || devis.status === 'refuse' || devis.status === 'expire' ? (
          <form action={genererAction}>
            <input type="hidden" name="jobId" value={jobId} />
            <Soumettre libelle="Générer le devis" enCours="Génération…" />
          </form>
        ) : null}

        {devis?.urlPdf ? (
          <a href={devis.urlPdf} target="_blank" rel="noopener noreferrer">
            <Button variant="secondaire" block>
              Ouvrir le PDF
            </Button>
          </a>
        ) : null}

        {devis && devis.status === 'brouillon' ? (
          <>
            <form action={envoyerAction}>
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="quoteId" value={devis.id} />
              <Soumettre libelle="Envoyer au client" enCours="Envoi…" variant="preuve" />
            </form>
            <p className="text-ardoise text-[0.8125rem]">
              Relisez le PDF avant d&apos;envoyer. C&apos;est le seul geste manuel de la chaîne,
              et c&apos;est volontaire.
            </p>
          </>
        ) : null}

        {devis?.status === 'accepte' ? (
          <Alert ton="succes">
            Devis accepté par le client. Il ne peut plus être régénéré.
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function PanneauPlanning({
  jobId,
  equipes,
  dureeMax,
}: {
  jobId: string;
  equipes: TeamRow[];
  dureeMax: number;
}) {
  const [etat, action] = useActionState<JobActionState, FormData>(planifierAction, {});

  // Valeur par defaut : demain 8 h. Le format datetime-local est local au
  // navigateur, donc sans suffixe Z.
  const demain = new Date(Date.now() + 86_400_000);
  demain.setHours(8, 0, 0, 0);
  const defaut = new Date(demain.getTime() - demain.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <Card>
      <CardHeader
        titre="Planifier"
        description={`Durée estimée ${Math.round(dureeMax / 60)} h — bloquée automatiquement`}
      />
      <CardBody className="flex flex-col gap-3">
        <Retour etat={etat} />
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="jobId" value={jobId} />

          <Field label="Début de l'intervention" required>
            {(p) => (
              <Input {...p} type="datetime-local" name="debut" defaultValue={defaut} required />
            )}
          </Field>

          {equipes.length > 1 ? (
            <Field label="Équipe">
              {(p) => (
                <Select {...p} name="teamId">
                  {equipes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          <Soumettre libelle="Planifier" enCours="Planification…" />
        </form>
        <p className="text-ardoise text-[0.8125rem]">
          Le créneau reste provisoire tant que le devis n&apos;est pas accepté. La base refuse
          tout chevauchement, trajet compris.
        </p>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function PanneauPortail({ jobId, aUnLien }: { jobId: string; aUnLien: boolean }) {
  const [etat, action] = useActionState<JobActionState, FormData>(regenererPortailAction, {});

  return (
    <Card>
      <CardHeader
        titre="Portail client"
        description={aUnLien ? 'Lien actif' : 'Aucun lien actif'}
      />
      <CardBody className="flex flex-col gap-3">
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}
        {etat.message ? (
          <Alert ton="succes" titre="Nouveau lien — copiez-le maintenant">
            <span className="font-mono text-[0.75rem] break-all">{etat.message}</span>
            <span className="mt-1.5 block text-[0.75rem]">
              Il ne sera plus affiché : seule son empreinte est conservée.
            </span>
          </Alert>
        ) : null}

        <form action={action}>
          <input type="hidden" name="jobId" value={jobId} />
          <Soumettre
            libelle={aUnLien ? 'Régénérer le lien' : 'Créer un lien'}
            enCours="Génération…"
            variant="secondaire"
          />
        </form>

        <p className="text-ardoise text-[0.8125rem]">
          Régénérer révoque immédiatement le lien précédent. Utile si le client l&apos;a
          transféré par erreur.
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Publication d'une realisation.
 *
 * Le champ de resume est libre et obligatoire. C'est volontairement le seul
 * travail manuel de toute la chaine : un texte genere a partir d'un gabarit
 * produirait vingt pages qui se ressemblent, et Google ne positionne pas des
 * pages qui se ressemblent. Trois phrases ecrites par celui qui etait sur
 * place valent mieux que trois paragraphes automatiques.
 */
export function PanneauRealisation({
  jobId,
  stage,
  publie,
  slug,
  resume,
  consentPhotos,
}: {
  jobId: string;
  stage: string;
  publie: boolean;
  slug: string | null;
  resume: string | null;
  consentPhotos: boolean;
}) {
  const [etat, publier] = useActionState<JobActionState, FormData>(
    publierRealisationAction,
    {},
  );
  const [retrait, depublier] = useActionState<JobActionState, FormData>(
    depublierRealisationAction,
    {},
  );

  if (stage !== 'termine') {
    return (
      <Card>
        <CardHeader titre="Réalisation" description="Chantier non terminé" />
        <CardBody>
          <p className="text-ardoise text-[0.8125rem]">
            Un chantier se publie une fois livré. Passez-le à « terminé » pour le proposer comme
            référence publique.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        titre="Réalisation"
        description={publie ? `En ligne — /realisations/${slug}` : 'Non publiée'}
      />
      <CardBody className="flex flex-col gap-3">
        {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}
        {retrait.error ? <Alert ton="danger">{retrait.error}</Alert> : null}
        {etat.message ? <Alert ton="succes">{etat.message}</Alert> : null}
        {retrait.message ? <Alert ton="succes">{retrait.message}</Alert> : null}

        {!consentPhotos ? (
          <Alert ton="alerte" titre="Consentement photo non accordé">
            La fiche sera publiée sans image. Le texte reste utile au référencement ; les photos
            ne sortent pas sans accord écrit du client.
          </Alert>
        ) : null}

        <form action={publier} className="flex flex-col gap-3">
          <input type="hidden" name="jobId" value={jobId} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">
              Résumé public — 80 caractères minimum
            </span>
            <textarea
              name="resume"
              rows={5}
              defaultValue={resume ?? ''}
              required
              minLength={80}
              placeholder="Maison de 140 m² à Enghien, livrée après plafonnage. Poussière de ponçage dans toutes les rainures de châssis, film plastique encore collé sur six vitrages. Sept heures d'intervention, vitres comprises."
              className="border-mineral-dark focus:border-ocean rounded-suiton w-full border p-3 text-sm focus:outline-none"
            />
            <span className="text-ardoise text-[0.75rem]">
              Ce texte est le H1 secondaire et la meta description de la page. Décrivez ce qui
              était sur place, pas ce que vous vendez.
            </span>
          </label>
          <Soumettre
            libelle={publie ? 'Mettre à jour la fiche' : 'Publier sur le site'}
            enCours="Publication…"
          />
        </form>

        {publie ? (
          <form action={depublier}>
            <input type="hidden" name="jobId" value={jobId} />
            <Soumettre libelle="Retirer du site" enCours="Retrait…" variant="secondaire" />
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
