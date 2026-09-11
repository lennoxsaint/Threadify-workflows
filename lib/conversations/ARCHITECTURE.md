# Conversation engine working map

Sources inspected at baseline `a14e6ee`: `docs/buyer-conversation-architecture.md`,
`lib/creator/store.mjs`, `lib/creator/review.mjs`, and `lib/creator/cli.mjs`.

The host imports minimal offer and conversation evidence into a private,
revisioned workspace. Pure engine functions turn that evidence into one exact
review action, commitments, content-question groups, and seven-day outcome
summaries. The host alone researches, drafts, asks for approval, and contacts a
provider. Before a host call, the engine persists a pending attempt and requires
fresh source reinspections; the later host-supplied receipt is stored without
being described as engine or provider verification.

This module owns conversation validation and state because creator review cards
require scheduling fields that would be false for replies, DMs, calls, and
promises. It copies the proven creator store mechanics into a separate
`conversation-state.v1` envelope and imports the existing canonical SHA-256
helper. Creator formats and scheduling behavior remain unchanged, and no new
generic persistence framework or dependency is introduced.
