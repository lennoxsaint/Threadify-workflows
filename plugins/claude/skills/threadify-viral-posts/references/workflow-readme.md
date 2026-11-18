# Viral Posts

If no setup choice is known, ask: "Would you like help connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md). Honor an existing choice.

Use the complete [installable skill](../../skills/threadify-viral-posts/SKILL.md), then say `/threadify-viral-posts`.

Viral Posts is for when you want new posts that look like the ones that already went viral for you. It finds the hook skeletons and post shapes that reached your top 10% by views at least twice, shows the evidence posts and view counts for each, and writes a small batch of new Threads posts on those exact skeletons from your own facts. Every post is checked: Threadify's validator, the skeleton line for line, a short hook, a fresh-reader check that the body gives what the hook promised, and every part of a thread shown in full. It then proposes one time per post, at least 2 hours clear of anything already queued.

Nothing is scheduled until you say yes to the exact batch. After the yes it schedules each post with a stable idempotency key, then checks that each one shows as "scheduled". It never publishes now.

Without a connection, paste your best posts with view counts and the facts to use. You get the same templates, checks and tentative times, labelled as local work.

Regression checks: `node --test validation/registry-tests/viral-posts.test.mjs`. No provider account or personal posts are needed.
