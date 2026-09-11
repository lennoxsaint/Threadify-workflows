# Context and glossary

Threadify Workflows is a public library for work an agent can prepare, review and resume. The five buyer workflows share a local conversation record and a small command interface. The host agent reads sources and uses supported external tools; the local module validates and stores evidence without claiming that an outside action occurred.

## Glossary

**Offer**  
The owner-confirmed help, deliverable, audience and limits used to judge whether a conversation is relevant. Run Offer Builder when this record is missing.

**Buyer evidence**  
A minimal source reference and factual note from a supplied or freshly inspected conversation. The public package does not copy a private conversation archive.

**Lead**  
A person who has shown interest in help or an offer relevant to the confirmed offer. A public question alone is not enough.

**Recipient interest**  
Evidence that the person wants the relevant help or offer. It does not by itself permit a DM, email or other channel action.

**Channel permission**  
Evidence that the recipient permitted contact through the proposed channel. It is separate from owner approval.

**Conversation opportunity**  
A supplied or freshly inspected conversation whose evidence maps to the confirmed offer and supports a useful next move. A generic question or unsupported profile match is not enough.

**Next step**  
The one evidence-backed action currently proposed for review, including its exact text, destination and hash. It remains a proposal until the owner approves that exact display.

**Action**  
One proposed next move bound to its evidence, exact text, destination and hash. Your Next Moves may prepare up to three, but review shows one at a time.

**Approval**  
The owner's explicit decision on the exact action currently displayed. Silence, a prior approval, a reminder or elapsed time is not approval.

**Commitment**  
An explicit promise with an owner, due date and source evidence. A vague intention is not a commitment.

**Outcome**  
What happened after an action or commitment. The record keeps `owner_reported` and `provider_observed` evidence distinct. A provider observation is called verified only when its source is authoritative readback for the claimed result.

**Outcome receipt**  
The append-only record that binds an attempted action to its observed or owner-reported result. It records uncertainty as `unknown` and never turns a local save into external delivery proof.

**Terminal state**  
A final recorded disposition: `fulfilled`, `declined`, `withdrawn` or `uncertain`. Silence is not a terminal success.

**Local state**  
Private, resumable records stored under an absolute directory chosen by the user on macOS or Linux. Release archives do not include this state.

**Hosted capability**  
A currently available provider tool used for account data or delivery. Configuration, entitlement and action readback must be verified at run time.

**Review reminder**  
An optional host-native prompt that the owner explicitly enables. It prepares a review candidate only and cannot approve or send an action.

See [Getting started](docs/getting-started.md) for the first run and [Buyer capability gaps](docs/buyer-capability-gaps.md) for the supported fallbacks.
