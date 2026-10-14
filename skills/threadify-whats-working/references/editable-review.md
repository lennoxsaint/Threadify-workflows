# Editable post review

Open one editable text block per generated post before choosing times or requesting scheduling approval. Preserve the exact generated original and any already-approved casing-only version. Keep the diagnosis report open separately.

Prefer native editable blocks only when the current host exposes supported editing controls and a real **Done editing** completion event. Inspect those controls first. Never invent a writing-block syntax, treat an autosave as completion, or claim a native editor exists when it does not.

If native editing or its completion signal is unavailable, state `editable_surface_unavailable` and use the bundled local editor. This is a fallback with real editable textareas and a button, not a claim of native chat support.

## Local editor

Prepare a private `draft-review.json` outside the public repository:

```json
{
  "auto_plugs": false,
  "posts": [
    {"id": "post-1", "original": "the exact first generated post", "mode": "unchanged"},
    {"id": "post-2", "original": "the exact second generated post", "mode": "unchanged"},
    {"id": "post-3", "original": "the exact third generated post", "mode": "unchanged"}
  ]
}
```

These are placeholders for the agent's input file, never public post copy. For requested casing, also supply `final`, `mode: "lowercase"`, `owner_request` and optional `keep`; the existing casing guard must pass. The internal references stay in local files and are never shown by the editor. Set `auto_plugs` to an earlier explicit choice, or false by default.

Run the command in the agent's active execution session:

```sh
node scripts/post-editor.mjs --input /private/run/draft-review.json --output /private/run/owner-review.json
```

Open the returned loopback URL in the user's browser and retain both the editor and report tabs. The command listens only on this computer. It prints the URL, then waits for the owner. Use the host's execution-session wait controls so the agent receives the command's completion after the click. Do not end the active handoff turn and pretend a file save will independently send a new chat message. Do not poll the public provider or create a recurring automation to watch local typing.

The owner edits all three textareas and can opt into **Include Auto Plugs**. Auto Plugs start off. Autosaves preserve the work but keep the receipt in `editing`. The **Done editing** button validates and saves the final text, exact comparisons and the Auto Plug choice. The command then reports `owner_review_done` and exits. The output file has `status: "done"`, preserved originals, final text and `approval: null`.

Only that real completion event allows the workflow to continue to review. It never authorizes scheduling. A failed save leaves the owner in the editor with a clear error; no draft is discarded. Completed reviews are locked. To edit again, open a new output file and invalidate any prior scheduling approval.

## After the click

- Read the saved receipt and compare `original`, `initial` and `final` for every post. Preserve the exact owner's bytes.
- A wording change uses `owner-requested edit` and the recorded owner request. It is not casing PASS. Unchanged or casing-only copies retain their original mode.
- Record short task-specific observations about hooks, rhythm, layout and endings. Separate changes to facts, numbers, attribution, offer and destination from wording lessons. One owner revision is not independent original voice evidence or an automatic global voice rule.
- Keep originals, revisions, comparisons and learning notes private. Public workflow improvements may describe general mechanics and writing patterns; never include owner bodies, account details, metrics or private prompt instructions.
- Pass the receipt as `editor_receipt` to the local review checker. Its final copy and Auto Plug choice must match the packet. Facts still need source review. A Done receipt never substitutes for exact provider validation or the owner's separate yes.
- If Auto Plugs are off, do no offer lookup, plug generation or plug validation. Omit `auto_plug` from the eventual schedule arguments and prove the saved off state on readback.

The editor has no publishing, scheduling, provider-write or feedback-send route. It saves a local review only.
