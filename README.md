# @unitsml/unitsdb

JavaScript release of [unitsdb-ruby](https://github.com/unitsml/unitsdb-ruby), published as [`@unitsml/unitsdb`](https://www.npmjs.com/package/@unitsml/unitsdb) on npm.

This is a **release-only repo**. All source lives in [`unitsml/unitsdb-ruby`](https://github.com/unitsml/unitsdb-ruby); this repo just packages the database and a thin JS read API. Don't edit `dist/` — it is rebuilt from the Ruby source on every release.

## Install

```bash
npm install @unitsml/unitsdb
```

## Quick start

```js
import { Unitsdb } from '@unitsml/unitsdb';

const db = Unitsdb.bundled();           // load the bundled units database
const meter = db.getById('NISTu1');     // → Unit entity
const hits = db.search('meter');        // → array of matching entities
const siUnits = db.findBySymbol('m');   // → units whose ASCII symbol is 'm'
const matches = db.matchEntities({ value: 'meter' });  // { exact: [...] }
```

The full method surface mirrors [`Unitsdb::Database`](https://github.com/unitsml/unitsdb-ruby/blob/main/lib/unitsdb/database.rb), camelCased:

| JS method | Ruby method |
|---|---|
| `getById(id, type?)` | `get_by_id(id:, type:)` |
| `findById(id, type)` | `find_by_type(id:, type:)` |
| `findByIdAndType(id, idType, type?)` | `get_by_id(id:, type:)` (with both filters) |
| `search(text, type?)` | `search(text:, type:)` |
| `findBySymbol(symbol, entityType?)` | `find_by_symbol(symbol, entity_type)` |
| `matchEntities({value, matchType, entityType})` | `match_entities(value:, match_type:, entity_type:)` |
| `validateUniqueness()` | `validate_uniqueness` |
| `validateReferences()` | `validate_references` |
| `collection(name)` | `collection(name)` |

## Versioning

Versions are **1:1 with the Ruby gem**. When `unitsdb-ruby` publishes `2.2.5`, this repo publishes `@unitsml/unitsdb@2.2.5` automatically. The dispatch chain (below) is the only path that produces a release.

## How the release flow works

```
┌──────────────────────┐   push: Bump unitsdb to X.Y.Z    ┌──────────────────────┐
│  unitsdb-ruby        │ ─────────────────────────────────▶│  unitsdb-ruby        │
│  release.yml         │                                   │  notify-unitsdb-js   │
│  (Cimas chain)       │                                   │  .yml                │
└──────────────────────┘                                   └──────────┬───────────┘
                                                                      │
                                                repository_dispatch: do-release
                                                payload: { version, ruby_ref }
                                                                      │
                                                                      ▼
                                                          ┌──────────────────────┐
                                                          │  unitsdb-js          │
                                                          │  release.yml         │
                                                          └──────────┬───────────┘
                                                                     │
                                                          idempotency check
                                                          `npm view @unitsml/unitsdb@X.Y.Z`
                                                                     │
                                                  ┌──────────────────┴───────────────────┐
                                                  │ not yet published                    │ already published
                                                  ▼                                      ▼
                                       checkout unitsdb-ruby@ruby_ref             skip with warning
                                       bundle install                             exit 0
                                       bundle exec ruby dump (Database#to_json)
                                       esbuild CJS + ESM bundle (inlined JSON)
                                       npm publish --access public
```

### Step-by-step

1. **Ruby gem release.** Triggered by either:
   - A maintainer running `gh workflow run release.yml --repo unitsml/unitsdb-ruby -f next_version=patch` (or `minor`/`major`), or
   - A `repository_dispatch` from upstream CI on a successful build.
2. **Ruby release workflow** (Cimas-managed `release.yml` in `unitsdb-ruby`):
   1. Bumps `lib/unitsdb/version.rb` to `X.Y.Z`.
   2. Commits "Bump unitsdb to X.Y.Z" on `main`.
   3. Tags `vX.Y.Z`.
   4. Runs gated tests; on pass, pushes the gem to RubyGems.
3. **Cross-repo dispatch.** The bump commit triggers [`notify-unitsdb-js.yml`](https://github.com/unitsml/unitsdb-ruby/blob/main/.github/workflows/notify-unitsdb-js.yml) in `unitsdb-ruby`, which:
   - Extracts the new version from `lib/unitsdb/version.rb`.
   - Fires `repository_dispatch` (`do-release`) to `unitsml/unitsdb-js` with payload `{ version, ruby_ref }`, authenticated via `UNITSML_CI_PAT_TOKEN`.
4. **JS release.** [`unitsdb-js/.github/workflows/release.yml`](.github/workflows/release.yml) receives the dispatch and:
   1. **Idempotency check.** `npm view @unitsml/unitsdb@X.Y.Z` — if the version is already on npm, exit green with a warning. Re-dispatching after a transient failure is always safe.
   2. **Checkout.** Pulls `unitsml/unitsdb-ruby` at `ruby_ref` (the tag) into `unitsdb-ruby/`.
   3. **Bundle.** `bundle install` against unitsdb-ruby's Gemfile (gives us `lutaml-model` + `unitsdb` itself).
   4. **Dump.** `bundle exec ruby` runs `Unitsdb.database.to_json` and writes it to `dist/unitsdb-data.json` (~430 KB).
   5. **Build.** [`scripts/build.js`](scripts/build.js) generates a small JS façade ([`src/database.js`](src/database.js)) with `getById` / `search` / `findBySymbol` / `matchEntities` / `validateUniqueness` / `validateReferences`, then esbuilds it into CJS + ESM bundles with the JSON inlined.
   6. **Publish.** `npm publish --access public` using the `NPM_TOKEN` repo secret.

### Why JSON dump + pure-JS façade (not Opal)?

The earlier plan was to Opal-compile the whole gem into one JS bundle. That hit a wall: `Opal::Builder` hangs on `lutaml-model`'s load tree (unitsdb-ruby's own Opal spec stubs it for the same reason), and even when it compiled, the bundle was multi-MB and shipped an embedded Ruby runtime.

The current approach ships a ~430 KB JSON dump (re-built from `Database#to_json` every release) plus a ~2 KB pure-JS façade that re-implements the read API. The Ruby gem stays the single source of truth for both data and reference-validation behavior; the JS package just re-expresses the read API in idiomatic JS.

## Releasing manually

The release workflow also accepts `workflow_dispatch` with a `version` input. Use this to re-trigger a failed release without going through the Ruby chain:

```bash
gh workflow run release.yml --repo unitsml/unitsdb-js -f version=2.2.5
```

The idempotency guard means re-runs are always safe — if `@unitsml/unitsdb@2.2.5` is already live, the workflow exits green.

## Required secrets

| Secret | Where | Used by |
|---|---|---|
| `UNITSML_CI_PAT_TOKEN` | `unitsml/unitsdb-ruby` | `notify-unitsdb-js.yml` to dispatch cross-repo |
| `NPM_TOKEN` | `unitsml/unitsdb-js` | `release.yml` for `npm publish` (automation token from the `unitsml` npm org) |

## License

BSD-2-Clause — same as `unitsdb-ruby`.
