# Meal Planner API

The Little Heroes meal planner (Parent Portal > Meal Planner, the Fridge Display's
"School meals" card and the 6:30 PM "Get ready for tomorrow" alert) can be read and
controlled by another app, such as a separate recipe vault / meal planner app.

It runs in `server.js` (`server/mealsService.js`) on the Pi and on Firebase App Hosting.
Changes are written to the household's synced data, so every family device and the
fridge pick them up within seconds.

## Turn it on

On the server that the other app will call (normally the Pi):

1. Make a token: `openssl rand -hex 32`
2. Add it to `~/apps/little-heroes.env` as `MEALS_API_TOKEN=<token>` (24+ characters).
   `HOUSEHOLD_CODES` must also be set (it already is for the fridge display).
3. If the other app runs in a browser on a different site, list its origin:
   `MEALS_API_ORIGINS=https://your-recipe-app.example`
4. Restart: `systemctl --user restart little-heroes.service`

Without a token the API answers `503` and stays off.

Base URL: `http://192.168.1.163:3000/api/meals/v1` on the home network, or the Pi's
Tailscale name from another device on the tailnet. Every request needs:

```
Authorization: Bearer <MEALS_API_TOKEN>
Content-Type: application/json
```

## Data

A planned meal ("entry"):

| field | type | notes |
| --- | --- | --- |
| `id` | string | letters, numbers, `_ . : -`, up to 80. Pick your own (e.g. your recipe app's plan id) with `PUT`, or let `POST` make one. |
| `date` | `YYYY-MM-DD` | required |
| `mealType` | `breakfast` \| `lunch` \| `dinner` \| `snack` | required |
| `title` | string | required, up to 80 |
| `notes` | string | up to 300 |
| `items` | string[] | up to 20 (ingredients or sides) |
| `heroIds` | string[] | which kids; empty means everyone |
| `replacesSchool` | boolean | breakfast/lunch only: the kids eat this instead of the school meal (a packed lunch). The school menu is hidden for that meal and the alert says "packed". |
| `recipeId` | string | your app's recipe id, up to 100 |
| `recipeUrl` | string | `https://` link to the recipe, shown in the Parent Portal |
| `emoji` | string | optional, e.g. `🌮` |
| `source` | string | shown as "from <source>"; defaults to `api` |
| `updatedAt` | number | set by the server (ms since 1970) |

Settings:

| field | type | notes |
| --- | --- | --- |
| `showSchoolMenu` | boolean | show the school breakfast/lunch at all |
| `showAllSchoolItems` | boolean | false = main dishes only (default); true = also sides, veggies, fruit, milk, sauces |
| `tomorrowLunchAlert` | boolean | add tomorrow's lunch to the 6:30 PM alert |
| `schoolSlug` | string | MealViewer school name, e.g. `CanterburyStreetMagnet` |
| `schoolName` | string | display name |

## Endpoints

| method | path | what it does |
| --- | --- | --- |
| `GET` | `/plan?from=YYYY-MM-DD&days=7[&weekends=true]` | Each day with its school meals (respecting `showAllSchoolItems`) and the family's meals, plus settings. Weekends without planned meals are skipped unless `weekends=true`. Up to 31 days. |
| `GET` | `/school?from=&days=` | The school's breakfast and lunch only: `{ school, days: [{ date, noSchool, breakfast: { main: [{name, emoji}], extras: [{name, group}] }, lunch }] }` |
| `GET` | `/entries?from=&to=` | The family's planned meals |
| `POST` | `/entries` | Add a meal; returns `201 { entry }` with a new `id` |
| `PUT` | `/entries/:id` | Add or update the meal with that id (fields you leave out keep their old value) |
| `DELETE` | `/entries/:id` | Remove it (`404` if there is none) |
| `GET` | `/settings` | `{ settings, mealTypes }` |
| `PATCH` | `/settings` | Change any of the settings above |

Errors come back as `{ "error": "..." }` with `400` (bad input), `401` (token),
`502` (couldn't reach the household or MealViewer) or `503` (API not set up).

The school menu alone is also public, without a token:
`GET /api/meals/school?school=CanterburyStreetMagnet&from=2026-11-30&days=5`.

## Examples

```sh
TOKEN=...; API=http://192.168.1.163:3000/api/meals/v1

# This week
curl -H "Authorization: Bearer $TOKEN" "$API/plan?days=7"

# Plan Tuesday's dinner from the recipe vault
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-12-01","mealType":"dinner","title":"Chicken tacos","recipeId":"r-42","recipeUrl":"https://recipes.example/r/42","source":"Recipe Vault"}' \
  "$API/entries/vault-2026-12-01-dinner"

# Packed lunch instead of school lunch on Wednesday
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-12-02","mealType":"lunch","title":"Turkey roll-ups","replacesSchool":true}' "$API/entries"

# Show all school items on the fridge
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"showAllSchoolItems":true}' "$API/settings"
```

## How syncing works

The plan lives in the household document's `stateSnapshot.mealPlan`. The API writes it with a
Firestore precondition (only if nobody else wrote in between, otherwise it re-reads and
retries). Every entry carries `updatedAt`, and deletes leave a tombstone for 30 days, so when a
phone and the API change the plan at the same time the newest version of each meal wins
(`mergeMealPlans` in `shared/mealPlan.js`). Meals older than 60 days are dropped.
