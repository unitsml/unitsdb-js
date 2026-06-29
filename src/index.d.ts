/**
 * @unitsml/unitsdb — JavaScript read API for the UnitsDB units
 * database.
 *
 * The actual data lives in `dist/unitsdb-data.json`, dumped at
 * build time from `Unitsdb::Database#to_json`. The query methods
 * are pure JS, mirroring the high-level surface of
 * [`Unitsdb::Database`](https://github.com/unitsml/unitsdb-ruby/blob/main/lib/unitsdb/database.rb).
 */

export type UnitsdbIdentifier = {
  id: string;
  type?: string;
};

export type UnitsdbLocalizedString = {
  value: string;
  lang?: string;
};

export type UnitsdbSymbolPresentations = {
  id?: string;
  ascii?: string;
  html?: string;
  latex?: string;
  mathml?: string;
  unicode?: string;
};

export type UnitsdbEntity = {
  identifiers: UnitsdbIdentifier[];
  short?: string;
  names?: UnitsdbLocalizedString[];
  symbols?: UnitsdbSymbolPresentations[];
  references?: Array<{ uri?: string; type?: string; authority?: string }>;
  unit_system_reference?: Array<UnitsdbIdentifier>;
  quantity_references?: Array<UnitsdbIdentifier>;
  root_units?: Array<{
    unit_reference?: UnitsdbIdentifier;
    prefix_reference?: UnitsdbIdentifier;
  }>;
};

export type UnitsdbDatabaseData = {
  schema_version: string;
  version?: string;
  prefixes: UnitsdbEntity[];
  dimensions: UnitsdbEntity[];
  units: UnitsdbEntity[];
  quantities: UnitsdbEntity[];
  unit_systems: UnitsdbEntity[];
};

export interface UnitsdbDatabase {
  schemaVersion: string;
  version?: string;
  prefixes: UnitsdbEntity[];
  dimensions: UnitsdbEntity[];
  units: UnitsdbEntity[];
  quantities: UnitsdbEntity[];
  unit_systems: UnitsdbEntity[];

  collection(name: string): UnitsdbEntity[];
  findById(id: string, type?: string): UnitsdbEntity | null;
  getById(id: string, type?: string): UnitsdbEntity | null;
  findByIdAndType(id: string, idType: string, type?: string): UnitsdbEntity | null;
  search(text: string, type?: string): UnitsdbEntity[];
  findBySymbol(symbol: string, entityType?: "units" | "prefixes"): UnitsdbEntity[];
  matchEntities(params: {
    value: string;
    matchType?: "exact" | "symbol" | "all";
    entityType?: string;
  }): Record<string, Array<{ entity: UnitsdbEntity; matchDesc: string; details: string }>>;
  validateUniqueness(): { short: Record<string, any>; id: Record<string, any> };
  validateReferences(): Record<string, Record<string, any>>;
}

export type UnitsdbModule = {
  bundled(): UnitsdbDatabase;
  fromJson(json: string | UnitsdbDatabaseData): UnitsdbDatabase;
};

export const Unitsdb: UnitsdbModule;
export default Unitsdb;
