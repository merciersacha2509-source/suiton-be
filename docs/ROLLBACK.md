# Rollback

**Règle unique : on rétablit d'abord, on comprend ensuite.**

Un site cassé qui reste cassé pendant qu'on cherche la cause coûte plus qu'un
retour arrière suivi d'une analyse tranquille. Ne jamais improviser une
correction directement en production.

---

## 1. Revenir au déploiement précédent — moins d'une minute

```bash
vercel ls suiton
vercel promote <url-du-deploiement-precedent>
```

Ou : **Vercel → Deployments → le précédent → Promote to Production**.

Instantané, sans reconstruction. **C'est le premier réflexe en cas de doute.**
Aucune information n'est perdue : le déploiement fautif reste consultable.

Ce que cela ne défait pas : les migrations de base déjà appliquées, et les
données écrites entre-temps.

---

## 2. Revenir sur une migration

Une migration appliquée ne s'annule pas d'un bouton.

| Type                                              | Action                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| **Additive** — index, colonne nullable, table     | Ne rien faire. Le code précédent l'ignore.           |
| **Destructive** — colonne supprimée, type modifié | Restaurer une sauvegarde. Il n'y a pas de raccourci. |
| **Bloquante** — contrainte trop stricte           | Écrire une migration corrective qui la relâche       |

**Avant toute `db push` en production, sans exception :**

```bash
supabase db dump -f sauvegarde-$(date +%Y%m%d-%H%M).sql --data-only
supabase db push --dry-run      # lire la sortie ligne par ligne
```

Supabase conserve des sauvegardes quotidiennes (7 jours en offre Pro).
**Vérifier que la rétention est active avant le premier client réel** : une
sauvegarde qu'on découvre absente le jour où on en a besoin n'existe pas.

Vérifier une fois par mois qu'une sauvegarde est réellement **restaurable**.
Une sauvegarde jamais restaurée est une hypothèse, pas une garantie.

---

## 3. Revenir sur le DNS

**Il n'existe pas de retour arrière rapide.** La propagation prend de quelques
minutes à plusieurs heures, et pendant ce temps le site peut être injoignable.

D'où la règle qui rend ce paragraphe rarement utile : **valider sur l'URL
`*.vercel.app` avant de pointer le domaine.**

Si le DNS est déjà cassé : rétablir les enregistrements précédents, puis
attendre. Rien d'autre à faire.

```
A       suiton.be         76.76.21.21
CNAME   www.suiton.be     cname.vercel-dns.com
```

---

## 4. Revenir sur une variable d'environnement

```bash
vercel env rm <NOM> production
vercel env add <NOM> production
vercel --prod                      # obligatoire : sinon rien ne change
```

Une variable ne prend effet qu'au **prochain déploiement**. La modifier sans
redéployer donne l'illusion d'un changement appliqué — et fait chercher le
problème au mauvais endroit.

**Cas particulier : `PORTAL_TOKEN_PEPPER`.** Le faire tourner **invalide tous
les liens de portail déjà envoyés aux clients**. Ce n'est pas un rollback,
c'est une rupture. À ne faire que si le poivre a fuité, et en prévenant les
clients concernés — leurs liens se régénèrent depuis la fiche du chantier.

---

## 5. En cas de fuite d'un secret

Dans l'ordre, sans s'arrêter pour comprendre :

1. faire tourner la clé chez le fournisseur (Supabase, Resend)
2. `vercel env rm` puis `vercel env add`
3. `vercel --prod` — la variable ne prend effet qu'au redéploiement
4. si `SUPABASE_SERVICE_ROLE_KEY` a fuité : considérer que **toutes** les
   données ont pu être lues. Cette clé contourne la RLS.
5. si `PORTAL_TOKEN_PEPPER` a fuité : voir § 4

---

## 6. Journal à tenir

Avant chaque mise en production, noter — trois lignes suffisent :

```
Date              :
Version deployee  :
Deploiement precedent (URL Vercel) :
Migrations appliquees :
Sauvegarde base   :
Point de retour   :
```

Ces cinq lignes sont ce qui distingue un rollback d'une minute d'une soirée à
chercher quelle version marchait.
