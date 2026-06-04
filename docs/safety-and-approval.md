# Safety And Approval

Every workflow that can mutate Threadify state must stop for explicit final approval.

## Approval Must Show

- workflow ID
- adapter/client
- Threadify account handle
- exact public text
- media filenames or URLs outside quoted text
- scheduled time and timezone, when relevant
- action to be taken
- fallback path, if MCP is unavailable

## Allowed Default Writes

V0 public workflows may use these write actions after approval:

- `schedule_post`
- `cancel_schedule`
- `reschedule_post`
- `record_feedback`

Status and validation tools may be used before approval when they do not mutate public state.

## Excluded From Public V0

Public V0 workflows must not call:

- `publish_now`
- `send_reply`
- `enable_auto_reply`
- Threadify-native generation tools

Those actions can be added later behind explicit premium workflow gates.
