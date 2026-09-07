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

The public local engine plans content, binds reviews and persists private
recovery state. It does not call providers. Keep that state outside public
repositories; checksums detect corruption, not malicious owner edits.

Connected generation, Brain writes, imports, scheduling and opt-in feedback use
Threadify's hosted services through the authorized host. Local receipts do not
prove those actions occurred. Preserve exact action approvals, current access
checks and provider readbacks. Core workflows exclude immediate publishing and
automatic replies. Private corpora and service implementation remain outside
this package.
