// Dependency-free JSON Schema (draft 2020-12) subset validator. Covers exactly what this repo's
// schemas/*.json use: type, required, properties, items, enum. Not a general-purpose validator —
// extend the `check` switch if a schema starts using a keyword this doesn't handle yet.

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function check(schema, value, path, errors) {
  if (schema.type) {
    const actual = typeOf(value);
    if (actual !== schema.type) {
      errors.push(`${path}: expected type ${schema.type}, got ${actual}`);
      return; // further checks on a wrong-typed value would just be noise
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.type === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}: missing required property "${key}"`);
    }
    for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) check(subSchema, value[key], `${path}.${key}`, errors);
    }
  }

  if (schema.type === 'array' && schema.items) {
    value.forEach((item, i) => check(schema.items, item, `${path}[${i}]`, errors));
  }
}

/** Validate `value` against a JSON Schema object. Returns an array of human-readable error
 * strings (empty when valid). */
export function validate(schema, value, label = '$') {
  const errors = [];
  check(schema, value, label, errors);
  return errors;
}
