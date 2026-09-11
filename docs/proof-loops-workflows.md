# Workflows from Proof Loops, episode 15 onward

Use the skill names below in your agent after installing the repository's plugin, or ask your agent to read the linked SKILL.md directly from a source checkout. Connecting the Threadify OAuth app is a separate step. Start with the [setup guide](threadify-001.md); the current MCP endpoint is `https://www.threadify.app/api/mcp/threadify`.

This index was checked on 11 September 2026 against episode production records. An episode topic is not proof of publication, and a public workflow is not a promise of the results shown in a video. Older screen labels, plan limits and tool counts can change; each workflow reads the current tool contract. No particular AI model is required.

| Episode | Workflow discussed | Public entry point |
| --- | --- | --- |
| 015 | Connect an AI agent to Threadify | [Setup guide](threadify-001.md); [secondary use-case recipes](proof-loops-use-cases.md) |
| 016 | Use Brain, audience and offer context to prepare a draft | [Brain-to-draft recipe](proof-loops-use-cases.md#brain-to-draft); [Create My Day](../skills/threadify-create-my-day/SKILL.md) |
| 017 | Prepare and approve a Greatest Hits Runway | [threadify-greatest-hits-runway](../skills/threadify-greatest-hits-runway/SKILL.md) |
| 018 | Find offer-matched conversations and stage useful replies | [threadify-qualified-buyer-research](../skills/threadify-qualified-buyer-research/SKILL.md) |
| 019 | Plan and review a day, week or month of content | [threadify-create-my-day](../skills/threadify-create-my-day/SKILL.md), [threadify-create-my-week](../skills/threadify-create-my-week/SKILL.md), [threadify-create-my-month](../skills/threadify-create-my-month/SKILL.md) |
| 020 | Audit and repair a Content Brain; compare the same prompt | [threadify-content-brain-repair](../skills/threadify-content-brain-repair/SKILL.md); [atomic Brain Sync](../skills/threadify-personal-brain-sync/SKILL.md) |
| 021 | Turn one photo into a reviewed carousel | [threadify-viral-carousel-maker](../skills/threadify-viral-carousel-maker/SKILL.md) |
| Current offer-interview production; episode number unconfirmed | Offer Architect interview and offer page | [threadify-offer-builder](../skills/threadify-offer-builder/SKILL.md) |

## What is available

The public source includes every entry linked above. Offer Builder is included in stable v0.7.0. The Day/Week/Month skills and Qualified Buyer Research predate that release; Viral Carousel Maker is included from v0.6.0. Greatest Hits Runway and Content Brain Repair are new source entry points added after v0.7.0; do not assume an older installed archive includes them. Read their source skill directly until installing a release that contains them.

Greatest Hits Runway requires eligible connected tools for hosted planning and scheduling. Content Brain Repair can prepare an audit locally; saving changes requires the intended account and approval. Qualified Buyer Research depends on a supported browser/client and keeps send authority explicit. Carousel generation depends on an available image provider. None of these dependencies is supplied or authorized merely by copying a skill file.

## Coverage boundary

Episodes 015–019 were checked against their production transcripts; 020 against its current filming record; 021 against its filming task and existing public package. The current offer-interview production has no confirmed episode number in the inspected record. No later uninspected episode or unavailable transcript is counted as covered. The named secondary examples in episode 015 are collected as recipes, not falsely represented as ten separately demonstrated skills.

For each new episode, add the public entry point here before promising viewers a download. Verify local links, bundle parity and any actual provider action separately. Keep source transcripts, customer data and private proof out of this repository.
