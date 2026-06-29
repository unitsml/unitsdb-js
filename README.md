# @unitsml/unitsdb

JavaScript release of [unitsdb-ruby](https://github.com/unitsml/unitsdb-ruby), compiled via [Opal](https://opalrb.com/) and published as `@unitsml/unitsdb` on npm.

This is a **release-only repo**. All source lives in [`unitsml/unitsdb-ruby`](https://github.com/unitsml/unitsdb-ruby); this repo just packages the Ruby gem as an npm bundle. Don't edit `dist/` — it is rebuilt from the Ruby source on every release.

## Install

```bash
npm install @unitsml/unitsdb
```

## Quick start

```js
import { Unitsdb } from '@unitsml/unitsdb';

const db = Unitsdb.bundled();           // load the bundled units database
const meter = db.getById('NISTu1');     // → Unit instance
const hits = db.search('meter');        // → array of matching entities
```

See [`unitsdb-ruby`'s `Database` API](https://github.com/unitsml/unitsdb-ruby/blob/main/lib/unitsdb/database.rb) for the full method surface — this package exposes the same methods, camelCased.

## Versioning

Versions are 1:1 with the Ruby gem. When `unitsdb-ruby` publishes `2.2.5`, this repo publishes `@unitsml/unitsdb@2.2.5` automatically via a `repository_dispatch` chain.

## How it works

1. `unitsdb-ruby` bumps version + tags on release.
2. A workflow in `unitsdb-ruby` fires `repository_dispatch` (`do-release`) to this repo.
3. This repo's [`release.yml`](.github/workflows/release.yml) workflow:
   - Checks out `unitsml/unitsdb-ruby` at the released tag.
   - Runs Opal to compile `lib/unitsdb/opal.rb` → `dist/unitsdb.js`.
   - Dumps the bundled database to JSON via `Database#to_json`.
   - Wraps both with a TypeScript façade via esbuild.
   - Publishes to npm as `@unitsml/unitsdb`.
4. The publish step is idempotent: if a version already exists on npm, the workflow exits cleanly so re-runs after a transient failure just work.

## Releasing manually

The workflow also accepts `workflow_dispatch` with a `version` input, useful for re-triggering a failed release without going through the Ruby chain:

```bash
gh workflow run release.yml -f version=2.2.5
```

## License

BSD-2-Clause — same as `unitsdb-ruby`.
