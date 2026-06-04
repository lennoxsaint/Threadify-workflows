# Fallback Playbook

If MCP is unavailable, blocked, missing scopes, or missing a required tool, do not claim automation.

## Fallback Output

Return a Threadify-ready artifact with:

- exact text
- media list
- target account handle if known
- target time and timezone if scheduling
- required manual action
- approval state
- reason MCP was not used

## Manual Path

1. Tell the user MCP could not complete the workflow.
2. Provide the exact payload to paste into Threadify.
3. Provide the manual scheduling or status-check steps.
4. Mark the receipt as `fallback_used: true`.

Fallback is still useful. It is not a live execution proof.
