# Publication Checklist

Use this checklist before any public repo sync.

## Required Checks

- `npm test` passes.
- README says MCP-ready workflow library, not directory-approved.
- Workflows remain orchestration-only.
- Local plugin wrapper points at the repo root so workflow manifests are bundled.
- No secrets, tokens, account IDs, raw member data, private course material, raw
  Current Self packets, or proprietary generation prompt internals are present.
- Redacted examples contain no private proof paths or personal metrics.
- Daily Greatest Hits examples use only redacted source themes and do not expose
  private analytics, account IDs, or paid generation internals.
- Fallback paths do not pretend live Threadify actions happened.

## Owner Gates

- Lennox approves public repo creation or sync.
- SamSam approves Threadify product claims.
- License posture is confirmed.
- Support/security contact is confirmed.
- Any OpenAI/Codex/Claude/Gemini submission remains separate from this public
  workflow repo.

## Actions Not Covered By This Repo

- Merging or deploying Threadify app code
- Applying production migrations
- Configuring production environment values
- Submitting to an app or connector directory
- Running live posts, schedules, replies, X actions, or Brain writes
