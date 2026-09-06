# Try a local creator review

From the package root, run `node examples/creator/local-day.mjs`.
No account, API key or dependency installation is needed beyond Node.js.
The example prepares five host-authored writing tips and stops at review.
It does not ask the engine to approve its own output.

Use `node examples/creator/local-day.mjs week` for a seven-day rolling blueprint,
or `node examples/creator/local-day.mjs month` for 28 days (four weeks).
Only Day 1 gets exact drafts. Continue returns the unresolved review first;
it must not skip ahead because a future blueprint exists.

Everything is synthetic: creator ID, source URLs, evidence labels and fixed
September 7, 2026 clock. The My Vault lane is a local planning category here,
not proof of saved items. Missing Viral and Greatest Hits lanes produce explicit
substitutions. Do not use these fixture labels as current claims or provider
evidence in a real plan.

The output includes the complete blueprint and five review cards, with exact
copy, proposed UTC times, source links, mode, gaps and hashes. Expected status:
zero approved, scheduled and published posts; provider writes are false.

Each run creates a new private temporary state directory and prints its exact
path. Inspect it with `node bin/threadify-workflows.mjs creator status --state
/absolute/path/from/output` (replace the path). Keep real creator state in a
dedicated private directory, not in this example or a public repository.

This is a runnable local walkthrough, not a demonstration of connected Brain
generation, actual rights verification, human approval or public delivery.
