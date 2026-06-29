/**
 * @unitsml/unitsdb — TypeScript façade over the Opal-compiled
 * unitsdb-ruby bundle.
 *
 * The actual Ruby implementation is compiled by Opal into
 * `dist/unitsdb.js` (UMD) at build time. This module loads that
 * bundle and re-exports the high-level Database surface with
 * JS-friendly names.
 *
 * See https://github.com/unitsml/unitsdb-ruby/blob/main/lib/unitsdb/database.rb
 * for the canonical API documentation.
 */

/// <reference types="node" />

declare global {
  // Opal attaches its runtime + loaded modules to `globalThis.Opal`
  // when the bundle is loaded outside of a bundler. esbuild handles
  // the import shape; this declaration covers both modes.
  // eslint-disable-next-line no-var
  var Opal: any;
}

declare const require: (id: string) => any;

type OpalDatabase = {
  // Public instance methods on Unitsdb::Database — see database.rb.
  collection(name: string): any[];
  findById(id: string, type?: string): any | null;
  getById(id: string, type?: string): any | null;
  search(params: { text: string; type?: string }): any[];
  findBySymbol(symbol: string, entityType?: string): any[];
  matchEntities(params: {
    value: string;
    matchType?: string;
    entityType?: string;
  }): Record<string, Array<{ entity: any; matchDesc: string; details: string }>>;
  validateUniqueness(): { short: Record<string, any>; id: Record<string, any> };
  validateReferences(): Record<string, Record<string, any>>;
};

type UnitsdbModule = {
  // Loads the bundled database (synchronous — data is pre-parsed at
  // build time and shipped inside the bundle).
  bundled(): OpalDatabase;
  // Loads a database from a JSON string produced by `Database#to_json`.
  fromJson(json: string): OpalDatabase;
};

/**
 * Entry point. Import as `import { Unitsdb } from "@unitsml/unitsdb"`.
 */
export const Unitsdb: UnitsdbModule;

export default Unitsdb;
