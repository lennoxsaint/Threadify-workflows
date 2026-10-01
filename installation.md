# Turn this AI into my Threadify social media operator

Give this file to your AI agent, or paste:

> Turn this AI into my Threadify social media operator. Install the latest stable Threadify Workflows from https://github.com/lennoxsaint/Threadify-workflows and run Get Set Up.

The guided setup handles the detail: account and agent connection, permissioned source discovery, Brain and voice verification, first-week preparation, review or scoped scheduling, recovery, and a clear pause control. The customer keeps control of login, consent, purchases, source access and consequential approvals.

## Instructions for the agent

This file is paired with Threadify Workflows **0.23.0**. It needs no sibling files. Fetch the official repository's release metadata for **v0.23.0**, confirm it is a published stable release, then use the canonical installer:

`npx --yes github:lennoxsaint/Threadify-workflows#v0.23.0 install --version 0.23.0 --workflows all --targets <DETECTED_CLIENT> --disable-auto-update`

The matching version must be a verified published stable release containing Get Set Up and Growth Loop, never a guessed version or main-branch snapshot. The canonical installer validates release manifests and checksums. If it is unavailable or does not contain `get-set-up` and `growth-loop`, explain that this installer is not released yet; do not substitute an older release. The copyable prompt above may select a newer verified release instead. Offer auto-updates separately.

Save the receipt, then invoke Get Set Up. If restarting the client is necessary, retain the private setup location and give the exact continuation prompt. Do not claim native discovery until checked in the new session. For unsupported browser-only chats, guide the customer to a supported agent first. Human login, consent and purchases remain human actions.

An OpenAI Dot is not a native installer target in this release. If the request starts inside a Dot, treat it as the orchestrator. Delegate the verified filesystem installation to Codex or another supported runtime on a connected computer only with the customer's approval. Return the runtime receipt and Threadify operator proof to the Dot. If that delegation is unavailable, explain the exact supported next step; browsing this repository alone is not an installation.
