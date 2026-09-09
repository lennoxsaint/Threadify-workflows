# Threadify-001: start here

Use this shared setup guide at the start of every workflow, before provider calls.
Ask one question, then follow the selected path:

> Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?

If the user already chose, acknowledge that choice instead of asking again.
When resuming a plan, retain the choice and resume unresolved work; do not repeat
signup prompts or create a new plan. Never make signup a prerequisite for local work.

## New to Threadify

1. Offer [the first-loop video with Lennox: Stop Using Threadify Like ChatGPT](https://www.youtube.com/watch?v=1HoIaLpB03A).
   It covers connecting Threads at 01:03, adding a real source at 04:55,
   creating a post at 12:17 and review at 16:04. The video is guidance, not
   current pricing or permission to perform its publishing steps.
2. Open [Threadify setup and current plans](https://www.threadify.app/plans?utm_source=threadify-workflows&utm_medium=github&utm_campaign=creator-workflows&utm_content=onboarding__first_loop__default&video_slug=threadify-001&cta_slot=onboarding&entry_angle=first_loop&lp_variant=plans).
   Explain the current offer before signup. On September 7, 2026 the public page
   advertised a seven-day free trial, card required, then $19/month unless
   cancelled. Recheck the live page; do not promise a permanently free account,
   unchanged prices, or included MCP/generation access. The open-source workflows
   themselves are free; hosted services depend on account access.
3. Guide one step at a time. The user completes signup, payment decisions,
   login and OAuth in the provider's own interface. Never ask for passwords,
   API keys, card details or verification codes in chat. Stop at security prompts.
4. Help the user connect their intended Threads account and add the official
   Threadify connection in their client's MCP/plugin settings using current
   official instructions. Do not invent a client menu, endpoint or authentication
   success. If installation controls are unavailable, give the exact available
   manual path and let the user return after connecting.
   The repository's official HTTPS MCP endpoint is
   `https://www.threadify.app/api/mcp/threadify` (also in the packaged `.mcp.json`).
   Add it only through your client's supported remote-MCP flow; authentication
   stays in the official connection screen. A configured URL is not proof of access.
5. When tools are actually available, call `get_connection_defaults` first.
   Confirm account, timezone, permissions and current access from readback.
   Setup is complete only when this readback matches the user's intention.
6. Return to the requested workflow. Start with one approved source and a
   reviewable draft, then build the chosen Day, Week or Month. Importing a source,
   saving a draft and scheduling are distinct actions with their own authority.

## Existing Threadify account

Reuse an already connected service. Otherwise guide the user through their
client's supported connection flow, then verify defaults as above. Never create
a second account or change plans just to finish setup. Missing shared Viral tools
do not block creation: use qualified Greatest Hits, My Vault or supplied sources
and record coverage gaps. No app deployment is required.

## Another MCP or plugin

Ask which provider/client the user wants, only if not already named. Inspect its
actual tools and official setup instructions before recommending installation.
Use only the user's selected provider; installing does not authorize content or
credential transfers. Do not assume it implements Threadify tool names, Brain,
Vault, analytics or scheduling semantics.

Map only verified capabilities: source reading, drafting, editable storage,
validation, scheduling and status readback. Identify the actual provider in every
receipt. Keep unsupported steps local/manual. The current creator engine accepts
Threadify authoritative validation for connected delivery; another provider is
preparation/export-only unless a tested adapter supports equivalent validation,
exact approval, conflict checks, idempotency and authoritative readback. Never
relabel another provider's response as Threadify or bypass the engine's gates.

## Work locally

Continue with user-supplied sources and confirmed facts. Explain unavailable
services briefly, without repeatedly selling signup. Keep local drafts and review
state honest: no provider draft ID, schedule or publication receipt is fabricated.
For a provider-only step, prepare the useful local artifact and name the missing
capability. Edit-only YouTube work does not require Threadify.

## Every path keeps the same controls

Connection choice is not permission to publish, schedule, import, send feedback
or upload private material. Show exact content, media, account, timezone and time
before any approved delivery. Preserve partial successes and reconcile uncertain
outcomes before retries. Never enroll a payment plan or complete a security step
for the user.
