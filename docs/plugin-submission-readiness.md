# Plugin submission preparation

Status: preparation only. Not submitted, release-ready or Directory accepted.
GitHub validation and separately approved release publication precede Directory
submission. Preparing these documents grants no external action authority.

## Package facts

The current manifest names `threadify-workflows`, MIT licensing and the public
Workflows repository. Four primary creator skills and seven advanced skills are
bundled, with three starter prompts: Vault Setup, Create My Day, Plan My Content.
Connected capabilities use the configured Threadify MCP endpoint; local review
does not require a Threadify account. Validate these facts against the final
artifact, not a remembered version or this document alone.

## Required evidence still to collect

Candidate metadata is now 0.5.0 in package, lockfile, plugin and release intent.
The release switch is false: candidate builds are allowed, but stable publication
is not enabled. QBR skill/rules remain at 0.4.0 because their behavior is unchanged.

- Final approval of candidate metadata and clean reviewed source commits/draft PRs.
- Persistent final artifact, archive hashes, extracted checks and final-artifact
  install/upgrade results; existing tests use temporary candidate/snapshot builds.
- Actual host discovery/loading and results for `plugin-reviewer-scenarios.md`.
- Separately approved live connected Day, with exact provider readbacks.
- Verified publisher identity, support contact, privacy policy and any required
  legal links. Manifest display name "Threadify" is not identity verification.
- Approved visual assets and proof that their final manifest paths resolve.
- Current official Directory submission requirements/form and release approval.

Publisher identity and the intended plugin support contact still require
confirmation. Do not substitute a plausible address, old private business
record or unrelated product policy.

## Public endpoint observations: September 7, 2026

The public [privacy policy](https://www.threadify.app/privacy) and
[terms](https://www.threadify.app/terms) were retrieved. Both display a June 24,
2026 update date and identify Saints Coaching as the operator. The privacy
contact shown is `learn@saintscoaching.com.au`. This verifies what the pages
state, not company registration, mailbox delivery or approval to use that
contact for plugin support.

An unauthenticated HTTP request to `https://www.threadify.app/support` followed
redirects to `/login` and returned HTTP 200 there. The homepage also resolved
to login in the web read. Do not describe either observation as a publicly
accessible help center. The support route exists in the app source, but its
authenticated behavior was not exercised. No support message was sent.

Use the policy URLs as verified public-page candidates in the submission
packet. Whether they sufficiently cover this plugin, and which verified
publisher/support identity belongs in the final submission, remain review
gates. No legal page or production configuration was changed.

## Privacy boundary for reviewers

The engine writes private local state; it does not send that state itself.
An authorized host may send selected content to Threadify for generation, draft
storage, imports, uploads, scheduling or opt-in learning. Media upload is an
external transfer and may produce a public URL. Shared-Viral imports disclose
potential shared inclusion before approval. Review only synthetic/publicly
cleared fixtures in the package; exclude user state and provider identifiers.

This describes implemented boundaries, not a replacement privacy policy.
Provider retention, account access and legal terms require verified sources.

## Handoff bundle

Include the final manifest/archive/checksums, source and artifact links,
`plugin-packaging.md`, `plugin-reviewer-scenarios.md`, skill disposition audit,
exact test outputs and a compact list of unmet gates. Mark every reviewer
scenario not run until its actual execution is recorded. Package validation,
automated fixture tests and screenshots prove different things.
