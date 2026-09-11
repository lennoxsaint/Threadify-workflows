# ADR 0001: Keep conversation state local

Status: accepted, 2026-09-11.

## Decision

Store offers, minimal conversation evidence, action reviews, commitments and outcomes in a private user-selected directory on macOS or Linux. Use hosted tools only when the requested step needs a current provider capability. The host agent performs source inspection and delivery; the local conversation module validates records, revisions and receipts.

State must stay outside public repositories, generated skills and release archives. A hosted response becomes provider proof only after authoritative readback. Optional native reminders are owner-enabled and review-only.

## Why

Local state gives the five workflows one resumable record without copying private conversations into release assets or inventing a hosted database. It also keeps local preparation useful when Threadify or another tool is unavailable.

## Consequences

POSIX state has current macOS and Linux support. Windows installation does not prove durable state execution. Unsupported hosts use the manual review artifact and must label continuity as unavailable. Local records do not prove a send, publication, sale or other outside outcome.
