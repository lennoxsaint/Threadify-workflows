# Creator record schemas

`schemas/creator-records.v1.json` defines JSON Schema 2020-12 contracts for
creator preferences, source records, horizon plans, daily reviews, delivery
attempts and outcome envelopes. Its `$defs/validation` describes the normalized
validation evidence stored by `record-validation`. Each creator skill bundles
the same file as `references/creator-records.v1.json`.

`npm ci` installs development-only AJV and format checks. `npm run test:creator`
compiles the schema in strict mode, validates actual engine outputs and rejects
malformed fixtures. The installed creator CLI remains dependency-free; no AJV
package is needed for local drafting or continuation.

These are structural contracts, not proof of source rights or provider truth.
Runtime checks additionally enforce exact hash/account matching, chronology,
freshness, complete placeholders, ownership, timezone/DST resolution, offer
selection, source uniqueness, approval and delivery transitions. Validation
does not fetch remote schemas or source URLs. Unknown future record versions
are rejected. Additional host metadata is permitted where a record does not
explicitly constrain it; it is not trusted as execution authority.

Missing source permission is representable because structure-only adaptation
must remain useful. A valid source-shaped record does not authorize literal
reuse. A valid approval-shaped record does not authorize scheduling without
the runtime's fresh preflight and separately authorized host action.

`schemas/creator-lifecycle.v1.json` covers setup and its display, import receipts
and attempts, local/opted-in feedback, reminder preparation, the creator
workspace and persisted state envelope. Load both files into the validator;
their references are resolved locally, not fetched from the identifier URLs.
Both files are bundled in each creator skill. Tests exercise actual import,
feedback, reminder and disk-state outputs as well as malformed variants.

Import and feedback schemas require receipt and consent shapes for their
respective states. Delivery receipts distinguish unknown, confirmed absence
and scheduled readback; observations allow only known nonnegative metrics or
null. These rules still do not compare hashes, verify checksums, establish
cross-record account equality or independently verify a provider. Existing
runtime checks and live evidence remain mandatory. Historical-state upgrade
compatibility and whole-system verification are separate unfinished gates.
