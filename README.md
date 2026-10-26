# Planification des transports — test technique SEFS1026

Module fullstack pour regrouper des commandes de vente dans des ordres de transport, de la sélection des commandes jusqu'au départ du véhicule.

| Couche | Technologies |
| --- | --- |
| API (`api/`) | NestJS 12, TypeScript, `mssql`, class-validator, Swagger, Vitest, oxlint |
| Front (`web/`) | Vue 3, TypeScript, TanStack Query, TanStack Table, Pinia, Vue Router, shadcn-vue (Tailwind v4, Reka UI), vue-i18n |
| Base | SQL Server 2022 (`docker-compose.yml` fourni, script `database/init.sql` inchangé) |

## Lancer le projet

Prérequis : Docker, Node.js 22.18+ ou 24.

```bash
# 1. Base de données (depuis la racine du dépôt)
docker compose up -d
docker compose ps        # attendre le statut "healthy" (environ 30 s)
docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Afk_Transport2026" -C -i /scripts/init.sql

# 2. API : http://localhost:3000, documentation Swagger sur http://localhost:3000/docs
cd api
cp .env.example .env
npm install
npm run start:dev

# 3. Front : http://localhost:5173
cd web
npm install
npm run dev
```

Le sélecteur en haut à droite change l'utilisateur courant (`diane` = répartiteur, `eric` = responsable logistique) et la langue (FR / EN).

### Tests

```bash
cd api && npm test                    # Vitest : règles métier (capacité, affectation, statuts), filtre d'erreurs
cd api && npm run test:e2e            # Vitest : API contre la vraie base (voir l'avertissement ci-dessous)
cd web && npm run test:unit -- --run  # modèles, store de planification, composant de jauge
```

> Les tests e2e **réinitialisent la base** en rejouant `database/init.sql` avant de s'exécuter. L'API doit donc être arrêtée, ou alors il faut accepter qu'elle perde ses données.

## Choix techniques

### API : trois couches avec des responsabilités nettes

```
controller  ->  service (cas d'usage, transactions)  ->  repository (SQL)
                    |
                    v
            domain/transport-order.rules.ts (fonctions pures)
```

- **Les règles métier sont des fonctions pures** (`api/src/transport-orders/domain/transport-order.rules.ts`). Elles reçoivent des données déjà chargées et lèvent une `BusinessError`. Elles n'ont aucune dépendance à SQL ni à HTTP, ce qui permet de les tester unitairement de façon exhaustive (règles de capacité, d'affectation et de changement de statut). C'est le test obligatoire du sujet.
- **Le service** orchestre chaque action dans une transaction : verrouiller ce dont la règle dépend, appeler la règle, écrire, puis renvoyer l'état à jour. Toute erreur, métier comprise, annule la transaction.
- **Les repositories** sont les seuls à connaître les noms de colonnes ERP (`[Total Weight (kg)]`, `[Customer No_]`...). Le mapping vers le camelCase se fait à un seul endroit, dans des fonctions `toXxx(row)`. Toutes les valeurs passent par `request.input(...)`. Les listes `IN (...)` sont, elles aussi, paramétrées (`bindList`).
- **Le rôle de l'utilisateur est une règle métier**, vérifiée dans le domaine (règle 8) et non dans un guard. Le guard global se contente de résoudre `X-User-Id` en utilisateur connu (401 sinon).

### Concurrence : les règles tiennent même avec deux répartiteurs simultanés

Une vérification « lire puis écrire » sans verrou laisse passer des doublons. Chaque règle sensible est donc protégée :

| Règle | Protection |
| --- | --- |
| Un seul ordre par véhicule et par date | `SELECT ... WITH (UPDLOCK, HOLDLOCK)` sur le créneau : une création concurrente attend la fin de la première, puis voit l'ordre créé. |
| Numérotation `TO-xxxx` | Lecture du dernier numéro sous `UPDLOCK, HOLDLOCK`, dans la même transaction que l'insertion. |
| Une commande dans un seul ordre | Les commandes demandées sont lues `WITH (UPDLOCK)`, triées par numéro pour limiter les deadlocks. La seconde transaction voit donc la commande « Planifiée ». |
| Capacité | L'en-tête de l'ordre est verrouillé (`UPDLOCK`) avant le calcul du poids : deux ajouts sur le même ordre sont sérialisés. |

Toutes les actions prennent les verrous dans le même ordre (en-tête de l'ordre, puis commandes, puis lignes), ce qui évite les interblocages entre un retrait et un ajout simultanés de la même commande.

En plus de ces verrous, le **`rowversion` (`timestamp`) sert à la concurrence optimiste** : le détail renvoie un champ `version`, et le front l'envoie dans l'en-tête `If-Match` lors des actions. Si l'ordre a changé entre-temps, l'API répond `409 STALE_TRANSPORT_ORDER` et le front recharge l'ordre. Ajouter ou retirer une ligne ne modifie pas la ligne d'en-tête : je « touche » donc l'en-tête (`SET [Status] = [Status]`) pour faire évoluer sa version. `If-Match` reste optionnel pour les clients qui ne l'envoient pas, comme la sélection depuis la liste des commandes. Dans ce cas, seuls les verrous s'appliquent.

Ces scénarios sont couverts par les tests e2e : deux créations simultanées sur le même créneau, et deux ajouts simultanés de la même commande dans deux ordres.

**Je n'ai pas modifié le schéma ERP.** En production, j'ajouterais aussi des index uniques sur `([Vehicle Code], [Delivery Date])` et sur `[Sales Order No_]` dans les lignes. La base garantirait alors elle-même ces règles, et les verrous seraient plus fins (aujourd'hui, `HOLDLOCK` sans index verrouille une plage plus large que nécessaire).

### Codes HTTP et format d'erreur

Toutes les erreurs ont la même forme : `{ statusCode, code, message, details? }`. Le `code` est stable (`CAPACITY_EXCEEDED`, `VEHICLE_ALREADY_BOOKED`...) et le front le traduit avec les `details` (poids, numéros de commandes). Le `message` en anglais sert aux logs et aux autres clients.

| Code | Quand |
| --- | --- |
| 400 | Requête mal formée (DTO invalide, date impossible, pagination hors bornes) |
| 401 | `X-User-Id` absent ou inconnu |
| 403 | Rôle insuffisant (validation par un répartiteur) |
| 404 | Ordre de l'URL inexistant, ou commande absente de l'ordre lors d'un retrait |
| 409 | Conflit avec l'état courant : véhicule déjà pris, commande déjà planifiée, ordre non brouillon, transition de statut invalide, version périmée. Un deadlock ou un timeout de verrou SQL Server (1205, 1222) devient aussi un 409 `CONCURRENT_MODIFICATION` (« réessayez ») plutôt qu'un 500. |
| 422 | Contenu de la requête contraire à une règle : date passée, véhicule inactif ou inconnu, capacité dépassée, validation d'un ordre vide |

### Autres décisions

- **« Aujourd'hui » est calculé dans le fuseau métier** (`APP_TIMEZONE=Africa/Douala`), pas dans celui du serveur, via un `Clock` injectable.
- **Les poids sont comparés en centièmes de kg entiers** (le type est `decimal(10,2)`), pour éviter que `0.1 + 0.2 > 0.3` refuse un chargement exact.
- **Les statuts sont exposés en libellés** (`DRAFT`, `TO_PLAN`...) plutôt qu'en `tinyint`, ce qui est plus lisible pour un client d'API. Le mapping se trouve dans `domain/transport-order.ts`.
- **Deux routes en plus de celles du sujet** : `GET /users` (alimente le sélecteur d'utilisateur, une seule source pour les rôles) et `GET /sales-orders/to-plan/cities` (valeurs du filtre par ville).
- **Les actions qui modifient renvoient le détail à jour**, y compris `DELETE` (200 plutôt que 204). Le front n'a pas besoin d'une seconde requête et récupère la nouvelle version.

### Front : état serveur et état d'interface séparés

```
web/src/api/
  transport/   client HTTP (X-User-Id, If-Match), ApiRequestError / ApiNetworkError
  resources/   types bruts renvoyés par l'API
  models/      classes au-dessus des ressources (getters, capacité, actions permises) + tests
  queries/     queryKeys + fabriques queryOptions / mutationOptions par ressource
features/      composants métier (dialogues, colonnes de tables, jauge, badge)
views/         les trois écrans
stores/        Pinia : uniquement l'état d'interface
```

- **TanStack Query porte l'état serveur** (cache, chargement, erreurs, nouvelle tentative, données précédentes gardées pendant un changement de page). Les requêtes et mutations sont déclarées une fois dans `api/queries` (`queries.transportOrders.detail(no)`, `mutations.transportOrders.validate(no)`...) et consommées avec `useQuery` / `useMutation`.
- **Après une mutation**, l'ordre renvoyé par l'API remplace directement le détail en cache (`setQueryData`). Les listes d'ordres et de commandes à planifier sont invalidées. Sur un 409, le détail est rechargé pour montrer l'état réel.
- **Pinia ne garde que l'état d'interface** : utilisateur courant, filtres, pagination et sélection de commandes (conservée d'une page à l'autre, donc hors de la table).
- **Les modèles** (`TransportOrderModel`...) encapsulent les calculs d'affichage : jauge de capacité, `canFit` pour griser les brouillons trop pleins, `actionsFor(role)` pour les boutons selon le statut et le rôle. C'est un confort d'interface : l'API reste juge.
- **TanStack Table** (headless) pilote les tableaux, rendus avec les composants Table de shadcn-vue. La pagination est faite côté serveur.
- **shadcn-vue** : les composants sont copiés dans `web/src/components/ui` (générés par la CLI, donc modifiables), sur Reka UI et Tailwind v4.
- **Les erreurs sont traduites par leur `code`** (`errors.CAPACITY_EXCEEDED`...), avec les `details` renvoyés par l'API.

## Ce qui manque / ce que je ferais avec plus de temps

- **Modifier le véhicule ou la date d'un brouillon** : le rôle répartiteur prévoit de « modifier » un ordre, mais le sujet ne liste pas de route pour cela. Je l'ajouterais avec un `PATCH /transport-orders/:no` qui rejoue les règles 1, 2 et 5 (la nouvelle capacité doit couvrir le chargement), protégé par `If-Match`.
- **Index uniques en base**, comme décrit plus haut, si le schéma ERP peut être enrichi.
- **Tests e2e du front** (Playwright) sur le parcours sélection → ajout → validation → départ. Le parcours a été vérifié à la main dans le navigateur, mais il n'est pas automatisé.
- **Création + ajout en une transaction** : depuis « Ajouter à un transport » avec un nouvel ordre, le front enchaîne deux appels. Les véhicules trop petits pour la sélection ne sont pas proposés, et si l'ajout échoue (commande prise entre-temps), une nouvelle tentative réutilise l'ordre créé au lieu d'en créer un second. L'ordre reste toutefois créé, vide, si l'utilisateur abandonne. Une route dédiée côté API rendrait l'opération atomique.
- **Plus de 100 brouillons** : la fenêtre d'ajout n'en charge que 100 (taille de page maximale de l'API). Au-delà, il faudrait une recherche ou un filtre par date.
- **Journal d'audit** des changements de statut (qui, quand) et horodatage de départ.
- **Ajout de commandes depuis le détail d'un ordre** : aujourd'hui, le bouton renvoie vers la liste des commandes à planifier.

## Temps passé

Entre 2-3 heures, avec l'assistance  d'un outil d'IA (Claude Code)
