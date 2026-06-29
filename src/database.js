// Pure-JS read façade over the bundled UnitsDB Database.
//
// Mirrors the high-level surface of Unitsdb::Database — enough to
// answer the queries JS consumers typically need (id lookup, text
// search, symbol lookup, reference/uniqueness validation). The
// canonical implementation lives in unitsdb-ruby; this is a
// re-expression in idiomatic JS, kept in sync via the bundled data
// dump produced at build time.
//
// Shape of `data` matches Unitsdb::Database#to_json from
// Lutaml::Model: { schema_version, version, units, prefixes,
// quantities, dimensions, unit_systems } where each collection is
// an array of entity objects.

const COLLECTIONS = ["prefixes", "dimensions", "units", "quantities", "unit_systems"];
const SYMBOL_COLLECTIONS = ["units", "prefixes"];

function lower(s) {
  return (s == null ? "" : String(s)).toLowerCase();
}

function collectionMatchesName(name) {
  if (!COLLECTIONS.includes(name)) {
    throw new Error(`unknown collection: ${name}`);
  }
}

class Database {
  constructor(data) {
    this.schemaVersion = data.schema_version;
    this.version = data.version;
    COLLECTIONS.forEach((c) => {
      this[c] = Array.isArray(data[c]) ? data[c] : [];
    });
  }

  collection(name) {
    collectionMatchesName(name);
    return this[name];
  }

  // Find first entity in `type` whose identifiers include `id`.
  findById(id, type) {
    if (type !== undefined) collectionMatchesName(type);
    const names = type ? [type] : COLLECTIONS;
    for (const name of names) {
      const hit = this[name].find((e) =>
        (e.identifiers || []).some((i) => i.id === id),
      );
      if (hit) return hit;
    }
    return null;
  }

  // Alias — matches the canonical Ruby method name.
  getById(id, type) {
    return this.findById(id, type);
  }

  // Find first entity in `type` whose identifiers include `id` AND
  // identifier `type` matches `idType`.
  findByIdAndType(id, idType, type) {
    if (type !== undefined) collectionMatchesName(type);
    const names = type ? [type] : COLLECTIONS;
    for (const name of names) {
      const hit = this[name].find((e) =>
        (e.identifiers || []).some(
          (i) => i.id === id && (idType == null || i.type === idType),
        ),
      );
      if (hit) return hit;
    }
    return null;
  }

  // Substring search across identifiers.id, names.value, short.
  search(text, type) {
    if (!text) return [];
    if (type !== undefined) collectionMatchesName(type);
    const needle = lower(text);
    const names = type ? [type] : COLLECTIONS;
    const results = [];
    for (const name of names) {
      for (const entity of this[name]) {
        const inIds = (entity.identifiers || []).some((i) =>
          lower(i.id).includes(needle),
        );
        const inNames = (entity.names || []).some((n) =>
          lower(n.value).includes(needle),
        );
        const inShort = lower(entity.short).includes(needle);
        if (inIds || inNames || inShort) results.push(entity);
      }
    }
    return results;
  }

  // Exact ASCII symbol match (case-insensitive). Applies to
  // Units and Prefixes only.
  findBySymbol(symbol, entityType) {
    if (!symbol) return [];
    if (entityType !== undefined && !SYMBOL_COLLECTIONS.includes(entityType)) {
      throw new Error(`entityType must be one of ${SYMBOL_COLLECTIONS.join(", ")}`);
    }
    const needle = lower(symbol);
    const names = entityType ? [entityType] : SYMBOL_COLLECTIONS;
    const results = [];
    for (const name of names) {
      for (const entity of this[name]) {
        const match = (entity.symbols || []).some((s) => lower(s.ascii) === needle);
        if (match) results.push(entity);
      }
    }
    return results;
  }

  // Exact-match short or name; optional symbol match for
  // units/prefixes. Mirrors Unitsdb::Database#match_entities.
  matchEntities({ value, matchType = "exact", entityType } = {}) {
    if (!value) return {};
    if (entityType !== undefined) collectionMatchesName(entityType);
    const result = { exact: [], symbolMatch: [] };
    const names = entityType ? [entityType] : COLLECTIONS;
    const wantExact = ["exact", "all"].includes(matchType);
    const wantSymbol = ["symbol", "all"].includes(matchType);

    for (const name of names) {
      for (const entity of this[name]) {
        if (wantExact) this._matchExact(entity, value, result);
        if (wantSymbol && SYMBOL_COLLECTIONS.includes(name)) {
          this._matchSymbol(entity, value, result);
        }
      }
    }

    if (result.exact.length === 0) delete result.exact;
    if (result.symbolMatch.length === 0) delete result.symbolMatch;
    return result;
  }

  _matchExact(entity, value, result) {
    const v = lower(value);
    if (entity.short && lower(entity.short) === v) {
      result.exact.push({
        entity,
        matchDesc: "short_to_name",
        details: `UnitsDB short '${entity.short}' matches '${value}'`,
      });
      return;
    }
    const nameHit = (entity.names || []).find((n) => lower(n.value) === v);
    if (nameHit) {
      result.exact.push({
        entity,
        matchDesc: "name_to_name",
        details: `UnitsDB name '${nameHit.value}' (${nameHit.lang || "?"}) matches '${value}'`,
      });
    }
  }

  _matchSymbol(entity, value, result) {
    const v = lower(value);
    const sym = (entity.symbols || []).find((s) => lower(s.ascii) === v);
    if (sym) {
      result.symbolMatch.push({
        entity,
        matchDesc: "symbol_match",
        details: `UnitsDB symbol '${sym.ascii}' matches '${value}'`,
      });
    }
  }

  // Returns { short: {...}, id: {...} } where each maps collection
  // name → { value → [paths] } for duplicates.
  validateUniqueness() {
    const out = { short: {}, id: {} };
    for (const name of COLLECTIONS) {
      const shorts = {};
      const ids = {};
      this[name].forEach((entity, idx) => {
        if (entity.short) {
          (shorts[entity.short] ||= []).push(`index:${idx}`);
        }
        (entity.identifiers || []).forEach((identifier, idIdx) => {
          if (identifier.id) {
            (ids[identifier.id] ||= []).push(`index:${idx}:identifiers[${idIdx}]`);
          }
        });
      });
      const shortDups = Object.fromEntries(
        Object.entries(shorts).filter(([, v]) => v.length > 1),
      );
      if (Object.keys(shortDups).length) out.short[name] = shortDups;
      const idDups = Object.fromEntries(
        Object.entries(ids)
          .map(([k, v]) => [k, [...new Set(v)]])
          .filter(([, v]) => v.length > 1),
      );
      if (Object.keys(idDups).length) out.id[name] = idDups;
    }
    return out;
  }

  // Returns { collectionName → { refPath → { id, type, refType } } }
  // for each entity whose references point at a non-existent id.
  // Same idempotent alternate-strategy behavior as the Ruby
  // ReferenceValidator: composite key, bare id, and (for unit
  // systems) si-base / SI_base / non-SI_* alternates.
  validateReferences() {
    const registry = this._buildIdRegistry();
    const invalid = {};

    const record = (fileType, refPath, ref) => {
      (invalid[fileType] ||= {})[refPath] = ref;
    };

    // unit_system_reference (units → unit_systems)
    this.units.forEach((unit, idx) => {
      (unit.unit_system_reference || []).forEach((ref, rIdx) => {
        const pair = this._destructure(ref);
        if (pair && !this._isValidRef(pair, "unit_systems", registry)) {
          record("units", `units:index:${idx}:unit_system_reference[${rIdx}]`, {
            id: pair.id,
            type: pair.type,
            refType: "unit_systems",
          });
        }
      });
    });

    // quantity_references (units → quantities)
    this.units.forEach((unit, idx) => {
      (unit.quantity_references || []).forEach((ref, rIdx) => {
        const pair = this._destructure(ref);
        if (pair && !this._isValidRef(pair, "quantities", registry)) {
          record("units", `units:index:${idx}:quantity_references[${rIdx}]`, {
            id: pair.id,
            type: pair.type,
            refType: "quantities",
          });
        }
      });
    });

    // root_units (units → units, prefixes)
    this.units.forEach((unit, idx) => {
      (unit.root_units || []).forEach((rootUnit, rIdx) => {
        if (rootUnit.unit_reference) {
          const pair = this._destructure(rootUnit.unit_reference);
          if (pair && !this._isValidRef(pair, "units", registry)) {
            record("units", `units:index:${idx}:root_units.${rIdx}.unit_reference`, {
              id: pair.id,
              type: pair.type,
              refType: "units",
            });
          }
        }
        if (rootUnit.prefix_reference) {
          const pair = this._destructure(rootUnit.prefix_reference);
          if (pair && !this._isValidRef(pair, "prefixes", registry)) {
            record("units", `units:index:${idx}:root_units.${rIdx}.prefix_reference`, {
              id: pair.id,
              type: pair.type,
              refType: "prefixes",
            });
          }
        }
      });
    });

    return invalid;
  }

  _destructure(ref) {
    if (!ref) return null;
    if (typeof ref === "string") return null;
    if (ref.id && ref.type) return { id: ref.id, type: ref.type };
    return null;
  }

  _buildIdRegistry() {
    const registry = {};
    for (const name of COLLECTIONS) {
      registry[name] = {};
      this[name].forEach((entity, idx) => {
        (entity.identifiers || []).forEach((identifier) => {
          if (!identifier.id || !identifier.type) return;
          registry[name][`${identifier.type}:${identifier.id}`] = `index:${idx}`;
          registry[name][identifier.id] = `index:${idx}`;
        });
      });
    }
    return registry;
  }

  _isValidRef(pair, refType, registry) {
    const bucket = registry[refType] || {};
    if (Object.prototype.hasOwnProperty.call(bucket, `${pair.type}:${pair.id}`)) {
      return true;
    }
    if (Object.prototype.hasOwnProperty.call(bucket, pair.id)) return true;
    if (refType === "unit_systems" && pair.type === "unitsml") {
      const alternates = [pair.id];
      if (pair.id.startsWith("si-")) alternates.push(`SI_${pair.id.slice(3)}`);
      if (pair.id.startsWith("nonsi-")) alternates.push(`non-SI_${pair.id.slice(6)}`);
      const keys = Object.keys(bucket);
      return alternates.some((alt) =>
        keys.some((k) => k.endsWith(`:${alt}`)),
      );
    }
    return false;
  }
}

module.exports = { Database, COLLECTIONS, SYMBOL_COLLECTIONS };
