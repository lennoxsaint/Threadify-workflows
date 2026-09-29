# Set up Threadify for me

Give this file to your AI agent, or paste:

> Set up Threadify for me using https://github.com/lennoxsaint/Threadify-workflows . Install the latest verified stable release, then run Get Set Up. Help me create an account, connect Threads and this agent, find my existing notes with permission, learn my voice, and prepare my first week. Ask only for missing information. Let me choose review or automatic scheduling. Verify the results and show me how to pause.

## Instructions for the agent

This file is paired with Threadify Workflows **0.21.0**. It needs no sibling files. Fetch the official repository's release metadata for **v0.21.0**, confirm it is a published stable release, then use the canonical installer:

`npx --yes github:lennoxsaint/Threadify-workflows#v0.21.0 install --version 0.21.0 --workflows all --targets <DETECTED_CLIENT> --disable-auto-update`

The matching version must be a verified published stable release containing Get Set Up, never a guessed version or main-branch snapshot. The canonical installer validates release manifests and checksums. If it is unavailable or does not contain `get-set-up`, explain that this installer is not released yet; do not substitute an older release. The copyable prompt above may select a newer verified release instead. Offer auto-updates separately.

Save the receipt, then invoke Get Set Up. If restarting the client is necessary, retain the private setup location and give the exact continuation prompt. Do not claim native discovery until checked in the new session. For unsupported browser-only chats, guide the customer to a supported agent first. Human login, consent and purchases remain human actions.
