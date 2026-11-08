# Agent instructions for Threadify Workflows

Read CONTRIBUTING.md before changing skills, scripts, manifests or anything under `plugins/`.

- Edit skills and scripts at their source (`plugins/threadify/skills/`, `lib/`, `tools/`, `docs/`, `workflows/`), never inside the generated `skills/`, `plugins/claude/` or `plugins/openai/` mirrors. Run `npm run bundle:build`, then `npm run validate`.
- `plugins/claude` is submitted to the Claude plugin directory. Its rules live in `lib/claude-plugin-policy.mjs` and the build refuses any change that breaks them: at most 512 files, no credential reads (no key or token environment variables, no `x-api-key` headers, no credential word next to a read word), no download-and-run (no `curl` or `wget` in scripts, no `sh -c`, no file that both talks to the network and starts processes), and nothing that runs the installer's self-updater.
- A skill that needs the owner's own API key for another service, or a separate engine, declares `external_credentials` or `external_engines` in its workflow manifest and stays out of the Claude plugin. Do not loosen the policy or the build to let it in.
- Commits and pushes run `scripts/guard-plugins.mjs` through `.githooks/` and `.claude/settings.json`. Never bypass them with `--no-verify`; fix the cause.
