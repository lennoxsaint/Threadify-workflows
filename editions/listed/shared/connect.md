# Connect Threadify

This plugin brings its own Threadify connection. Scheduling needs that connection and a Threadify account.

## Connect in ChatGPT or Codex

1. When a step needs Threadify, choose **Connect** on the Threadify plugin.
2. Sign in on the official Threadify screen. New users can create an account there.
3. Approve the access the screen shows, then come back to the same chat.

Sign-in stays on that screen. Do not ask for passwords, codes or keys in chat.

A finished connection is not proof of access. Call `get_connection_defaults` first. Confirm the account handle, timezone and current permissions from what it returns. Check the tool list before you rely on a tool, and do not invent a tool result.

If the connection is missing or fails, say so plainly. Keep the approved copy and stop before any schedule step.

## Keep actions separate

Connecting is not permission to schedule, publish, reply or share anything. Before each action, show the exact text, media, account, time and action. Then wait for a clear yes to that exact item. Silence or an earlier yes is not approval.

Note each attempt before you make it. Afterwards, read back the real result and keep what succeeded. Check an attempt with an unknown result before you try it again.
