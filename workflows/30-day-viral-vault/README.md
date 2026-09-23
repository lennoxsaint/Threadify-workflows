# 30-Day Viral Vault

Build a compact 30-day content blueprint, prepare only today's six posts, and review exactly one unresolved post at a time.

## What it does

- Confirms the creator account, timezone, goal and six distinct daily posting times.
- Creates 30 days of source/topic/time slots without generating 180 drafts upfront.
- Requires two owned Greatest Hits, two eligible Viral Vault sources and two eligible My Vault sources each day.
- Uses exact reposts only for owned Greatest Hits and literal fill-in only for owned, licensed or permissioned sources with complete placeholder evidence.
- Shows one card, then waits for `approve`, `edit`, `edit and approve`, `skip` or `reject` before exposing the next card.
- Schedules only after exact approval, durable intent, fresh preflight and exact provider readback. It never calls immediate publication.

## Goal modes

- **Reach first:** no CTA by default.
- **Balanced:** one offer-aligned card and at most one earned CTA.
- **Lead first:** three buyer-problem cards and at most one earned CTA.

These modes organize inputs; they do not promise reach, virality, followers or leads.

## Install and start

Install the full stable catalog for your client:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets codex
```

Replace `codex` with `claude`, `cursor`, `gemini`, `openclaw` or `hermes`, or omit `--targets` to use detected clients. Then ask the agent to “set up my 30-day viral vault” or invoke `threadify-30-day-viral-vault` directly.

Local planning and sequential review require no Threadify connection. Connected source reads, editable drafts, validation and scheduling depend on the tools and entitlement actually available in the current session.

## Safety boundary

The workflow stores its state in a dedicated private directory chosen by the user. Source bodies and draft copy stay out of this public repository. A schedule receipt is not publication, and an ambiguous scheduling result blocks retries until it is reconciled.
