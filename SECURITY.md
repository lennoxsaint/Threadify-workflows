# Security Policy

## Reporting Security Issues

Email security concerns to the Threadify owner team through the support channel
listed at https://www.threadify.app.

Do not open public issues containing credentials, private account details,
member data, private workflow packets, or provider callback details.

## What Must Never Be Committed

- OAuth tokens or bearer tokens
- Local MCP proxy configuration
- Threadify account IDs or provider account IDs
- Private course material or member data
- Raw Current Self packets
- Private generation prompts or quality-system internals

## Public Workflow Boundary

This repository is orchestration-only. Live scheduling, publishing, Brain
writes, provider writes, analytics, receipts, and entitlements stay inside
Threadify.
