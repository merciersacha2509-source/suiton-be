# Moteur documentaire SUITON OS

Sept documents, une seule charte, aucune mise en page manuelle.

---

## Vue d'ensemble

```
src/lib/pdf/
├── fonts/                  Jura + Inter en TTF, versionnés dans le dépôt
├── fonts.ts                enregistrement auprès de @react-pdf
├── tokens.ts               couleurs, échelle typographique, registre des 7 types
├── blocks/
│   ├── styles.ts           feuille de style unique des sept documents
│   └── index.tsx           blocs réutilisables
├── documents/
│   ├── types.ts            contrats de données (aucune logique)
│   ├── devis.tsx           facture.tsx      rapport.tsx
│   ├── bon-intervention.tsx attestation.tsx
│   └── fiche-chantier.tsx  rapport-qualite.tsx
├── compose.ts              RÈGLES MÉTIER — pur, testable, sans rendu
└── render.ts               rendu serveur
```

**La séparation qui compte** : `compose.ts` transforme des données métier en
données d'affichage déjà formatées (`« 1 145,00 € »`, pas `1145`). Les
composants ne calculent rien. C'est ce qui permet de tester la TVA, les
forfaits ou les points sensibles sans jamais rendre un PDF — les 114 tests
tournent en 300 ms.

---

## Les blocs

| Bloc                    | Rôle                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `BlocEnTete`            | Marque, coordonnées légales, filet                           |
| `BlocTitre`             | Titre + ligne de métadonnées                                 |
| `BlocPartie`            | Client, chantier, émetteur — même forme partout              |
| `BlocColonnes`          | Deux colonnes d'information                                  |
| `BlocSection`           | Titre de section souligné                                    |
| `BlocTableau`           | Colonnes configurables, alternance de fonds, ligne de détail |
| `BlocTotaux`            | Sous-total, TVA, total en pavé sombre                        |
| `BlocEncadre`           | Quatre tons : preuve, légal, neutre, succès                  |
| `BlocChiffres`          | Bande de chiffres clés                                       |
| `BlocPaires`            | Comparaisons avant/après                                     |
| `BlocSignatures`        | Pavés de signature                                           |
| `BlocPied`              | Coordonnées, type de document, pagination                    |
| `Marque` `Coche` `Case` | SVG — aucun caractère spécial                                |

Corriger un en-tête le corrige sur les sept documents. C'est la définition
d'une collection.

---

## Les sept documents

| Document                           | Destinataire | Particularité                                                                              |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| **Devis**                          | Client       | Forfaits, jamais de prix au m². Double signature « Bon pour accord ».                      |
| **Facture**                        | Client       | Autoliquidation automatique, communication structurée (modulo 97), loi du 2 août 2002.     |
| **Rapport d'intervention**         | Client       | Chronologie horodatée, observations, garantie, page avant/après.                           |
| **Attestation de fin de chantier** | Client       | Une page, des faits, une signature. Pour l'assurance ou le syndic du client.               |
| **Bon d'intervention**             | Équipe       | Adresse et téléphone en gros, points sensibles **déduits**, cases à cocher. Aucun montant. |
| **Fiche chantier**                 | Interne      | Score, écart de durée, historique. Bandeau « ne pas transmettre ».                         |
| **Rapport qualité**                | Interne      | Écart par étape, couverture photo, points de vigilance.                                    |

### Ce qui est déduit, jamais saisi

Personne ne remplit un champ « points d'attention » avant chaque chantier. Le
bon d'intervention les **calcule** : salissure lourde, surface > 250 m²,
urgence, hors zone, service. Et il en affiche **quatre au maximum** — au-delà,
personne ne lit, et le cinquième dilue le premier.

Le rapport qualité déduit de même ses points de vigilance, dont celui-ci :
six étapes cochées à la même minute signalent une checklist remplie après
coup, ce qui lui retire sa valeur de preuve.

---

## Chaîne automatique

```
Réservation              → devis
Devis accepté            → bon d'intervention + fiche chantier
Intervention terminée    → rapport + attestation + rapport qualité
Facture payée            → fiche finale + archive
```

Deux propriétés, dans `src/lib/services/pipeline.ts` :

**Idempotence.** Le registre calcule l'empreinte SHA-256 du PDF. Un document
identique n'est pas réécrit — un double clic sur « Générer » ne produit pas
une v2, v3, v4 qui rendraient l'historique illisible.

**Tolérance à l'échec.** La production d'un document annexe qui échoue ne
remet jamais en cause l'opération métier. Un devis accepté sans bon
d'intervention se rattrape ; un devis accepté qu'on aurait perdu, non.

---

## Registre et versioning

Table `documents` : type, numéro, **version**, chemin, empreinte, instantané
des données de génération.

Régénérer un devis ne l'écrase pas : cela crée la version 2 et marque la
version 1 comme remplacée (trigger `documents_supersede`). C'est la seule
façon de répondre à « ce n'est pas ce devis que j'ai reçu » — avec la date
d'envoi et le destinataire à l'appui.

L'archive (`job_archives`) est un instantané **dénormalisé** : une archive qui
dépend de six jointures n'est plus une archive. Elle survit à l'anonymisation
du client, qui ne peut pas effacer les pièces comptables — conservation
obligatoire de dix ans.

---

## Impression

- **Polices embarquées** : Jura et Inter en TTF dans le dépôt. Aucune requête
  réseau au rendu, rendu identique dans trois ans même si un CDN disparaît.
- **Pas de césure** : `registerHyphenationCallback` renvoie le mot entier.
  « autoliqui-dation » au milieu d'une mention légale fait amateur.
- **Coupures maîtrisées** : `wrap={false}` sur les blocs indivisibles.
- **Conditions sur deux colonnes**, équilibrées **par longueur** et non par
  nombre — sinon une mention de quatre lignes et une d'une ligne dans la même
  colonne font déborder le bloc et emportent la signature avec lui.

### Deux pièges @react-pdf, corrigés

**L'espace fine insécable.** `Intl.NumberFormat('fr-BE')` sépare les milliers
par U+202F, absent des polices : « 3 744,00 € » se rendait « 3/744,00 € ». Un
test le vérifie sur chaque montant de chaque document.

**La prop `render`.** Elle est évaluée **après** le calcul du sous-ensemble de
glyphes : avec des polices embarquées, la pagination disparaît silencieusement.
Nos documents ayant un nombre de pages déterministe, la pagination est passée
explicitement — et devient testable.

---

## E-mails

Six modèles dans `src/lib/emails/`, à la charte SUITON.

| Modèle                   | Pièce jointe                                       |
| ------------------------ | -------------------------------------------------- |
| Envoi du devis           | Devis PDF                                          |
| Rappel de devis          | — (le ton change à moins de 5 jours de l'échéance) |
| Confirmation de chantier | —                                                  |
| Rapport disponible       | Rapport **et** attestation                         |
| Facture                  | Facture PDF                                        |
| Demande d'avis           | —                                                  |

**Le document est joint, pas seulement lié.** Un lien signé expire ; une pièce
jointe reste dans la boîte du client pour toujours. Le lien accompagne la
pièce jointe, il ne la remplace pas.

**La demande d'avis ne comporte aucune condition de satisfaction.** Tous les
chantiers clos sont sollicités, à la même échéance, avec le même message.
Filtrer selon la satisfaction présumée est du _review gating_ : Google le
sanctionne par le retrait rétroactif des avis existants.

Le gabarit d'e-mail utilise la pile de polices système, pas Jura ni Inter :
aucune boîte mail ne les charge. L'identité tient aux couleurs, à
l'interlettrage du mot-marque et à la structure.

---

## Vérification

```bash
npm run verify    # types + lint + 114 tests + build
npm run test:db   # 49 assertions contre PostgreSQL
```

Les sept documents ont été générés et relus page par page. Devis, facture,
attestation, bon d'intervention, fiche chantier et rapport qualité tiennent
sur une page ; le rapport en fait deux quand il porte des photos.
