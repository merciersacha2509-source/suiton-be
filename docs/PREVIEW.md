# Preview

Une preview est une version **complète et réelle** de suiton.be, déployée sur
une URL temporaire, que Sacha peut parcourir avant toute mise en ligne.

Elle est identique à la production sur tout **sauf** trois points, et ces trois
différences sont volontaires.

|            | Preview                                        | Production          |
| ---------- | ---------------------------------------------- | ------------------- |
| URL        | `suiton-<hash>.vercel.app`                     | `https://suiton.be` |
| Indexation | **interdite** — robots.txt, meta, en-tête HTTP | index, follow       |
| Courriels  | **capturés**, consultables sur `/dev/emails`   | envoyés réellement  |
| Données    | démonstration, marquées `DÉMO —`               | clients réels       |
| Bandeau    | visible, orange                                | absent              |

---

## 1. Déployer une preview

```bash
npm run go-live        # 536 contrôles — aucun déploiement si un point est rouge
vercel                 # SANS --prod : Vercel crée une preview
```

Vercel renvoie une URL. **Elle est indépendante de suiton.be** : aucun trafic
réel n'y passe, aucun visiteur ne peut y arriver par hasard.

Avec l'intégration Git, toute branche autre que `main` produit
automatiquement une preview à chaque poussée.

---

## 2. Variables d'environnement de la preview

Dans **Vercel → Settings → Environment Variables**, environnement **Preview** :

```
APP_ENV=preview
NEXT_PUBLIC_APP_ENV=preview
EMAIL_MODE=preview
NEXT_PUBLIC_SITE_URL=https://suiton-preview.vercel.app
NEXT_PUBLIC_SUPABASE_URL=<projet de STAGING, jamais celui de production>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé du staging>
SUPABASE_SERVICE_ROLE_KEY=<clé du staging>
PORTAL_TOKEN_PEPPER=<valeur DIFFÉRENTE de la production>
NOTIFY_EMAIL=demo@suiton.invalid
```

Trois points sur lesquels ne pas transiger :

**Un projet Supabase distinct.** Une preview branchée sur la base réelle y
créerait des chantiers de test, des devis de test et des jetons de portail de
test. On les retrouve six mois plus tard dans les statistiques.

**Un poivre différent.** `PORTAL_TOKEN_PEPPER` dérive les jetons de portail.
Le même poivre des deux côtés rendrait un lien de preview valable en
production, et l'inverse.

**`EMAIL_MODE=preview`.** Le contrôle de cohérence au démarrage refuse
`EMAIL_MODE=production` avec `APP_ENV=preview`, mais autant ne pas s'en
remettre à un garde-fou quand on peut poser la bonne valeur.

---

## 3. Pourquoi une preview ne doit jamais être indexée

Une preview indexée est un **doublon intégral de suiton.be** dans l'index de
Google : deux domaines, le même contenu, une cannibalisation qu'on met des
mois à défaire. Le risque n'est pas théorique — une URL partagée dans un
message suffit à la faire découvrir.

Trois protections, redondantes à dessein :

1. `robots.txt` renvoie `Disallow: /` hors production
2. chaque page porte `noindex, nofollow, nocache`
3. l'en-tête HTTP `X-Robots-Tag: noindex, nofollow, noarchive` couvre **tout
   ce qui sort du serveur** — y compris le sitemap, les PDF et les réponses
   d'API, que la balise meta ne couvre pas

Vérifier après déploiement :

```bash
curl -s https://<preview>.vercel.app/robots.txt          # Disallow: /
curl -sI https://<preview>.vercel.app | grep -i x-robots # noindex, nofollow
```

---

## 4. Ce qu'il faut vérifier soi-même

Les 536 contrôles automatisés ne voient pas le rendu. Ce qui suit ne
s'automatise pas et constitue le vrai travail de validation.

### Sur un vrai téléphone — le point le plus important

| Écran          | À regarder                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Accueil        | Le titre tient-il en trois lignes ? Les trois boutons sont-ils atteignables au pouce ?          |
| Calculateur    | Le curseur de surface se manipule-t-il sans zoomer ? Le prix bouge-t-il pendant le glissement ? |
| Barre du bas   | Masque-t-elle le dernier élément de la page ? Apparaît-elle au bon moment ?                     |
| Réservation    | Les six étapes, jusqu'au bout. Le clavier masque-t-il le bouton suivant ?                       |
| Dépôt de photo | Depuis l'appareil photo, pas seulement la galerie                                               |
| Portail        | Avec un vrai lien. Les documents s'ouvrent-ils ?                                                |

Tester en portrait **et** en paysage. Le paysage est celui qu'on oublie.

### Les trois boutons

- **Appeler** ouvre le composeur avec `0489 21 01 24`
- **WhatsApp** ouvre le fil avec le message pré-rempli
- **Réserver** mène au parcours

Sur desktop, `tel:` peut ne rien faire selon la configuration : ce n'est pas
un défaut du site.

### Le fond

- Les huit pages locales décrivent-elles **votre** réalité ? Vous êtes le seul
  à pouvoir le dire.
- Les prix affichés correspondent-ils à ce que vous factureriez ?
- Les garanties sont-elles celles que vous tenez ?

Une page techniquement parfaite qui décrit mal le métier ne convertit pas.

### Les courriels

Sur `/dev/emails`, relire les sept messages. Le ton, les fautes, la clarté du
lien de portail. Ce sont eux que le client lit en premier.

---

## 5. Ce que vous me renvoyez

Un simple retour suffit :

- **validé** — je prépare la mise en ligne, et j'attends `GO PRODUCTION SUITON`
- **à corriger** — dites ce qui ne va pas, même en une ligne
- **bloquant** — on ne parle pas de production tant que ce n'est pas réglé

Une remarque du type « le bouton est trop bas sur mon téléphone » vaut mieux
qu'un rapport structuré. Je m'occupe de la traduction technique.
