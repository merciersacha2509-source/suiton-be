'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { zonePourCodePostal, LIBELLES_ZONE } from '@/lib/zones';
import { Stepper } from './stepper';
import { ChoiceCard } from './choice-card';
import { EstimationBar } from './estimation-bar';
import { PhotoUploader } from './photo-uploader';
import { SlotPicker } from './slot-picker';
import { Confirmation } from './confirmation';
import {
  BIENS,
  ETAPES,
  ETAT_INITIAL,
  SALISSURES,
  SERVICES,
  type EtatReservation,
  type GrillePublique,
} from './types';

type Erreurs = Partial<Record<keyof EtatReservation, string>>;

interface Succes {
  reference: string;
  url_portail: string;
  estimation: { min: number; max: number; surDevis: boolean };
  courriel_envoye: boolean;
}

/**
 * `prefill` provient du calculateur public. Les valeurs ont deja ete
 * validees cote serveur ; le parcours ne fait que les reprendre pour ne pas
 * demander deux fois la meme chose au visiteur.
 */
export interface PrefillReservation {
  service?: EtatReservation['service'];
  soil?: EtatReservation['soil'];
  surface_m2?: number;
  code_postal?: string;
  property_type?: EtatReservation['property_type'];
  urgent?: boolean;
}

export function BookingWizard({
  settings,
  prefill,
}: {
  settings: GrillePublique;
  prefill?: PrefillReservation;
}) {
  const [etape, setEtape] = useState(1);
  const [etat, setEtat] = useState<EtatReservation>(() => {
    const depart: EtatReservation = { ...ETAT_INITIAL };
    if (prefill?.service) depart.service = prefill.service;
    if (prefill?.soil) depart.soil = prefill.soil;
    if (prefill?.surface_m2) depart.surface_m2 = prefill.surface_m2;
    if (prefill?.code_postal) depart.code_postal = prefill.code_postal;
    if (prefill?.property_type) depart.property_type = prefill.property_type;
    if (prefill?.urgent) depart.urgent = true;
    return depart;
  });
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState<Succes | null>(null);

  const maj = useCallback(
    <K extends keyof EtatReservation>(cle: K, valeur: EtatReservation[K]) => {
      setEtat((prev) => ({ ...prev, [cle]: valeur }));
      setErreurs((prev) => ({ ...prev, [cle]: undefined }));
    },
    [],
  );

  /**
   * Validation par etape. Elle double la validation Zod du serveur — celle-ci
   * reste la seule qui protege. Ici, il s'agit uniquement de ne pas laisser
   * quelqu'un arriver a l'etape 6 pour apprendre que l'etape 2 etait fausse.
   */
  function validerEtape(n: number): boolean {
    const e: Erreurs = {};

    if (n === 2) {
      if (etat.commune.trim().length < 2) e.commune = 'Indiquez la commune.';
      if (!/^[0-9]{4}$/.test(etat.code_postal))
        e.code_postal = 'Code postal belge à 4 chiffres.';
    }

    if (n === 3) {
      const s = etat.surface_m2;
      if (typeof s !== 'number' || Number.isNaN(s)) e.surface_m2 = 'Indiquez la surface.';
      else if (s < 10) e.surface_m2 = 'Minimum 10 m².';
      else if (s > 5000) e.surface_m2 = 'Au-delà de 5 000 m², appelez-nous.';
    }

    if (n === 6) {
      if (etat.nom.trim().length < 2) e.nom = 'Indiquez votre nom.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(etat.email)) e.email = 'Adresse e-mail invalide.';
      if (etat.telephone.trim().length < 8) e.telephone = 'Numéro de téléphone invalide.';
      if (etat.est_pro && !/^BE[0-9]{10}$/.test(etat.tva.toUpperCase().replace(/[\s.]/g, ''))) {
        e.tva = 'Numéro de TVA belge invalide (BE0123456789).';
      }
      if (!etat.consent_cgv) e.consent_cgv = 'Vous devez accepter les conditions.';
    }

    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  function suivant() {
    if (!validerEtape(etape)) {
      // Le focus part sur le premier champ fautif, sinon un utilisateur au
      // clavier ne sait pas ce qui bloque.
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setEtape((n) => Math.min(ETAPES.length, n + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function precedent() {
    setErreurs({});
    setEtape((n) => Math.max(1, n - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function soumettre() {
    if (!validerEtape(6)) return;

    setEnvoi(true);
    setErreurGlobale(null);

    try {
      const reponse = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: etat.service,
          property_type: etat.property_type,
          soil: etat.soil,
          surface_m2: etat.surface_m2,
          commune: etat.commune,
          code_postal: etat.code_postal,
          adresse: etat.adresse || undefined,
          urgent: etat.urgent,
          date_souhaitee: etat.creneau
            ? etat.creneau.debut.slice(0, 10)
            : etat.date_souhaitee || undefined,
          photos: etat.photos.map((p) => p.id),
          notes: etat.notes || undefined,
          nom: etat.nom,
          email: etat.email,
          telephone: etat.telephone,
          est_pro: etat.est_pro,
          tva: etat.est_pro ? etat.tva.toUpperCase().replace(/[\s.]/g, '') : undefined,
          consent_photos: etat.consent_photos,
          consent_cgv: true,
          honeypot: '',
        }),
      });

      const json = await reponse.json();

      if (!reponse.ok || !json.ok) {
        if (reponse.status === 429) {
          setErreurGlobale(
            json.error ?? 'Trop de demandes. Réessayez plus tard ou appelez le 0489 21 01 24.',
          );
        } else if (reponse.status === 422 && Array.isArray(json.issues)) {
          const champs: Erreurs = {};
          for (const i of json.issues as { path: string; message: string }[]) {
            champs[i.path as keyof EtatReservation] = i.message;
          }
          setErreurs(champs);
          setErreurGlobale('Certaines informations sont incorrectes.');
        } else {
          setErreurGlobale(json.error ?? "L'envoi a échoué. Réessayez dans un instant.");
        }
        return;
      }

      setSucces(json.data as Succes);
    } catch {
      setErreurGlobale(
        'Connexion interrompue. Votre demande n’a pas été envoyée — réessayez, ou appelez le 0489 21 01 24.',
      );
    } finally {
      setEnvoi(false);
    }
  }

  if (succes) return <Confirmation succes={succes} delaiHeures={settings.delai_devis_heures} />;

  const zone = etat.code_postal.length === 4 ? zonePourCodePostal(etat.code_postal) : null;

  return (
    <div className="pb-4">
      <h1 className="font-heading mb-1 text-2xl font-semibold">Demander un devis</h1>
      <p className="text-ardoise mb-6 text-sm">
        Six étapes, deux minutes. Estimation immédiate, devis ferme sous{' '}
        {settings.delai_devis_heures} heures.
      </p>

      <Stepper courante={etape} />

      {erreurGlobale ? (
        <Alert ton="danger" className="mb-4">
          {erreurGlobale}
        </Alert>
      ) : null}

      <h2 className="font-heading mb-4 text-lg font-semibold">{ETAPES[etape - 1]?.titre}</h2>

      {/* --- 1. Service ---------------------------------------------------- */}
      {etape === 1 ? (
        <fieldset className="flex flex-col gap-2.5 border-0 p-0">
          <legend className="sr-only">Type de prestation</legend>
          {SERVICES.map((s) => (
            <ChoiceCard
              key={s.code}
              name="service"
              value={s.code}
              checked={etat.service === s.code}
              onChange={(v) => maj('service', v as EtatReservation['service'])}
              titre={s.titre}
              description={s.description}
            />
          ))}
        </fieldset>
      ) : null}

      {/* --- 2. Lieu ------------------------------------------------------- */}
      {etape === 2 ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field label="Commune" required error={erreurs.commune}>
              {(p) => (
                <Input
                  {...p}
                  value={etat.commune}
                  onChange={(e) => maj('commune', e.target.value)}
                  invalid={Boolean(erreurs.commune)}
                  autoComplete="address-level2"
                  placeholder="Nivelles"
                  autoFocus
                />
              )}
            </Field>
            <Field label="Code postal" required error={erreurs.code_postal}>
              {(p) => (
                <Input
                  {...p}
                  value={etat.code_postal}
                  onChange={(e) =>
                    maj('code_postal', e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  invalid={Boolean(erreurs.code_postal)}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="1400"
                />
              )}
            </Field>
          </div>

          <Field
            label="Adresse"
            hint="Facultatif à ce stade. Nous la demanderons à la confirmation."
          >
            {(p) => (
              <Input
                {...p}
                value={etat.adresse}
                onChange={(e) => maj('adresse', e.target.value)}
                autoComplete="street-address"
                placeholder="Rue et numéro"
              />
            )}
          </Field>

          {zone === 'exceptionnelle' ? (
            <Alert ton="alerte" titre="Hors de notre zone habituelle">
              Nous intervenons quand même, mais le déplacement est chiffré au cas par cas.
              Continuez : vous recevrez un devis honnête, sans surprise.
            </Alert>
          ) : zone ? (
            <p className="text-ardoise text-[0.8125rem]">
              {LIBELLES_ZONE[zone]}
              {zone === 'secondaire'
                ? ' — frais de déplacement forfaitaires.'
                : ' — sans frais de déplacement.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- 3. Surface et etat -------------------------------------------- */}
      {etape === 3 ? (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Surface à nettoyer (m²)" required error={erreurs.surface_m2}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={5000}
                  value={etat.surface_m2}
                  onChange={(e) =>
                    maj('surface_m2', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  invalid={Boolean(erreurs.surface_m2)}
                  placeholder="140"
                  autoFocus
                />
              )}
            </Field>

            <Field label="Type de bien">
              {(p) => (
                <Select
                  {...p}
                  value={etat.property_type}
                  onChange={(e) =>
                    maj('property_type', e.target.value as EtatReservation['property_type'])
                  }
                >
                  {BIENS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.titre}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-1 text-[0.8125rem] font-medium">Niveau de salissure</legend>
            {SALISSURES.map((s) => (
              <ChoiceCard
                key={s.code}
                name="soil"
                value={s.code}
                checked={etat.soil === s.code}
                onChange={(v) => maj('soil', v as EtatReservation['soil'])}
                titre={s.titre}
                description={s.description}
              />
            ))}
          </fieldset>

          <label className="min-h-touch rounded-suiton border-mineral-dark flex cursor-pointer items-start gap-3 border p-3.5">
            <input
              type="checkbox"
              checked={etat.urgent}
              onChange={(e) => maj('urgent', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#0B2239]"
            />
            <span>
              <span className="block text-sm font-medium">C&apos;est urgent</span>
              <span className="text-ardoise mt-0.5 block text-[0.8125rem]">
                Intervention sous 15 jours. Majoration de{' '}
                {Math.round(settings.majoration_urgence * 100)} %, annoncée d&apos;emblée.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {/* --- 4. Photos ------------------------------------------------------ */}
      {etape === 4 ? (
        <PhotoUploader
          photos={etat.photos}
          onChange={(photos) => maj('photos', photos)}
          onErreur={setErreurGlobale}
        />
      ) : null}

      {/* --- 5. Creneau ----------------------------------------------------- */}
      {etape === 5 ? (
        <SlotPicker
          surface={typeof etat.surface_m2 === 'number' ? etat.surface_m2 : 100}
          soil={etat.soil}
          choisi={etat.creneau}
          onChange={(c) => maj('creneau', c)}
        />
      ) : null}

      {/* --- 6. Coordonnees ------------------------------------------------- */}
      {etape === 6 ? (
        <div className="flex flex-col gap-4">
          <Field label="Nom et prénom" required error={erreurs.nom}>
            {(p) => (
              <Input
                {...p}
                value={etat.nom}
                onChange={(e) => maj('nom', e.target.value)}
                invalid={Boolean(erreurs.nom)}
                autoComplete="name"
                autoFocus
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse e-mail" required error={erreurs.email}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  value={etat.email}
                  onChange={(e) => maj('email', e.target.value)}
                  invalid={Boolean(erreurs.email)}
                  autoComplete="email"
                />
              )}
            </Field>
            <Field label="Téléphone" required error={erreurs.telephone}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  value={etat.telephone}
                  onChange={(e) => maj('telephone', e.target.value)}
                  invalid={Boolean(erreurs.telephone)}
                  autoComplete="tel"
                  placeholder="0489 21 01 24"
                />
              )}
            </Field>
          </div>

          <label className="min-h-touch flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={etat.est_pro}
              onChange={(e) => maj('est_pro', e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#0B2239]"
            />
            <span className="text-sm">Je suis un professionnel (entreprise, indépendant)</span>
          </label>

          {etat.est_pro ? (
            <Field
              label="Numéro de TVA"
              required
              error={erreurs.tva}
              hint="Obligatoire : la facture doit être transmise par Peppol au format structuré."
            >
              {(p) => (
                <Input
                  {...p}
                  value={etat.tva}
                  onChange={(e) => maj('tva', e.target.value.toUpperCase())}
                  invalid={Boolean(erreurs.tva)}
                  placeholder="BE0123456789"
                />
              )}
            </Field>
          ) : null}

          <Field
            label="Précisions"
            hint="Accès, étage, contraintes horaires, ce qu'on doit savoir."
          >
            {(p) => (
              <Textarea
                {...p}
                value={etat.notes}
                onChange={(e) => maj('notes', e.target.value.slice(0, 1000))}
                rows={3}
              />
            )}
          </Field>

          {/* Consentement photo : distinct des conditions, decoche par defaut,
              revocable a tout moment depuis le portail. */}
          <label className="rounded-suiton border-mineral-dark flex cursor-pointer items-start gap-3 border p-3.5">
            <input
              type="checkbox"
              checked={etat.consent_photos}
              onChange={(e) => maj('consent_photos', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1E6E78]"
            />
            <span>
              <span className="block text-sm font-medium">
                J&apos;autorise SUITON à publier les photos de mon chantier
              </span>
              <span className="text-ardoise mt-0.5 block text-[0.8125rem]">
                Facultatif et sans effet sur le prix. Ni votre nom ni votre adresse exacte ne
                sont affichés. Révocable à tout moment depuis votre dossier.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={etat.consent_cgv}
              onChange={(e) => maj('consent_cgv', e.target.checked)}
              aria-invalid={Boolean(erreurs.consent_cgv)}
              className="mt-1 h-4 w-4 accent-[#0B2239]"
            />
            <span className="text-sm">
              J&apos;accepte que SUITON traite ces informations pour établir mon devis.{' '}
              <span className="text-danger">*</span>
            </span>
          </label>
          {erreurs.consent_cgv ? (
            <p role="alert" className="text-danger -mt-2 text-[0.8125rem]">
              {erreurs.consent_cgv}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- Navigation ----------------------------------------------------- */}
      <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
        {etape > 1 ? (
          <Button variant="secondaire" size="lg" onClick={precedent} disabled={envoi}>
            Retour
          </Button>
        ) : (
          <span />
        )}

        {etape < ETAPES.length ? (
          <Button size="lg" onClick={suivant} className="sm:min-w-44">
            Continuer
          </Button>
        ) : (
          <Button size="lg" onClick={soumettre} disabled={envoi} className="sm:min-w-44">
            {envoi ? 'Envoi…' : 'Envoyer ma demande'}
          </Button>
        )}
      </div>

      {etape >= 3 ? (
        <div className="mt-6">
          <EstimationBar etat={etat} grille={settings} />
        </div>
      ) : null}
    </div>
  );
}
