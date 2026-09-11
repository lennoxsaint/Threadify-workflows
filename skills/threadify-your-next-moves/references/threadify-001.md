# Threadify-001: local first, connect when useful

Start the requested workflow with the offer and sources the user already supplied. Do not make provider choice, signup or connection the first question. Ask about a connection only when a useful step needs current account data or a supported external action.

## Local first run

1. Confirm the requested outcome in one sentence.
2. Reuse an existing offer record. If none exists, run [Offer Builder](../workflows/offer-builder/README.md) and return to the same task.
3. Accept the user's supplied conversations or inspect only the approved source. Keep the full archive private and store the minimum factual evidence needed for the workflow.
4. Prepare a local result. Display one review item at a time and keep unknown evidence explicit.
5. Ask about a connection only when it would unlock a specific useful step. Name that step and keep a manual fallback available.

## Connect an existing Threadify account

Use the client's supported remote MCP flow with:

```text
https://www.threadify.app/api/mcp/threadify
```

Authentication stays in the official connection screen. Do not ask for passwords, API keys, payment details or verification codes in chat. A configured URL or successful install does not prove access.

When tools are available, call `get_connection_defaults` first. Confirm the intended account, timezone, permissions and current access from readback. Inspect current tool schemas before depending on a capability. Do not invent a menu, entitlement or tool result.

For Threadify setup and the current offer, open the fully attributed [Threadify plans page](https://www.threadify.app/plans?utm_source=threadify-workflows&utm_medium=github&utm_campaign=buyer-workflows&utm_content=onboarding__buyer_workflows__default&video_slug=threadify-001&cta_slot=onboarding&entry_angle=buyer_next_moves&lp_variant=plans). The [first-loop video with Lennox](https://www.youtube.com/watch?v=1HoIaLpB03A) shows connecting Threads at 01:03, adding a source at 04:55, creating a post at 12:17 and review at 16:04. The video is guidance from its recording date, not current terms, tool availability or permission to repeat its public actions.

The user completes signup, plan choices, login, OAuth and security steps in the provider interface. Return to the original workflow after current account readback. Do not create another account or change a plan just to finish the task.

## Use another provider

If the user names another MCP or plugin, inspect its current tools and official setup before relying on it. Identify the provider in receipts. Keep unsupported steps local; another provider's response is not Threadify proof.

The public conversation workflows need exact approval, pending-attempt persistence, conflict or duplicate protection where applicable, and authoritative result readback. When an adapter cannot provide those controls, prepare the artifact for manual use and record the outcome as unknown until the owner supplies evidence.

## Keep actions separate

Connection is not permission to import, save, schedule, publish, reply, send feedback or transfer private material. Show the exact content, destination, account, timing and action before approval. Recipient interest and channel permission are separate from owner approval.

Persist a pending attempt before an approved external action. Reinspect the source, reconcile the real result and preserve partial success. Never infer permission from silence or retry an unknown delivery. Optional native reminders prepare review candidates only and send nothing.

Windows installation is not proof that private local state ran. On unsupported hosts, use the manual fallback in [Buyer workflow capability gaps](buyer-capability-gaps.md).
