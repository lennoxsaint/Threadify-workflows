# Listed edition

This folder builds the package we submit to OpenAI's plugin directory (shared by ChatGPT and Codex). It is separate from the self-installed Threadify Workflows bundle: `lib/release-files.mjs` only ships an allow-list of top-level folders, and `editions/` is not on it.

The listed edition is small on purpose. It ships twelve skills that run with only the Threadify MCP server, in the portable Agent Plugins format: Get Set Up, Create My Week, Inbound Replies, Daily Posts Heartbeat, Greatest Hits Runway, Weekly Winner Replication, Monetize My Week, Personal Brain Sync, Content Brain Repair, Threads Teach, Crosspost X After Threads and X Article From Daily Post. Listed copy carries no plans links, prices, trials or local helper scripts, and every skill that schedules calls `review_post` first and passes its approval to `schedule_post`. Inbound Replies calls `review_reply` before each send and passes its approval to the send tool.

## What is here

| Path | Role |
| --- | --- |
| `edition.json` | Source of truth: version, listing metadata (including the four listing URLs and starter prompts), the `review` and `publication` sections OpenAI imports from the ZIP, MCP server, assets and the selected skills. Each skill has a `description` override, `drop` globs, `add` files and anchored `replace` rules, or an `override` folder. |
| `overrides/<name>/` | Hand-written listed skills that replace an upstream skill outright: Get Set Up, Create My Week and Inbound Replies. Their upstream versions depend on local helpers, files and pages that a listed plugin cannot use. |
| `shared/connect.md` | Link-free connection guide that replaces the setup reference, which carries plans links. |
| `assets/` | Source logo (1024 px) and composer icon (512 px). |
| `assets/screenshots/` | Three 706-pixel-wide PNGs of the screen (the review panel in light and dark, and the calendar), shown in the listing. The preflight allows screenshots only while a tool in `contract/tools.json` draws in the screen, and checks each is exactly 706 wide and 400–860 tall, OpenAI's rule. |
| `build.mjs` | Generates `package/`. `--check` rebuilds in memory and fails on any difference. |
| `package/threadify/` | The generated plugin: `plugin.json`, `mcp.json`, `assets/` and `skills/`. Committed so a PR diff shows exactly what ships. |
| `package/.agents/plugins/marketplace.json` | Local marketplace for testing the plugin in Codex. It sits outside the plugin folder and is not submitted. |
| `package.lock.json` | SHA-256 digests of every input (including upstream skill files that get dropped) and every output. |
| `preflight.mjs` | Mirrors OpenAI's automated checks for a folder, plus our stricter policy lint and the tool-name check. `--final` and `--online` are for the owner's upload copy. |
| `contract/tools.json` | Snapshot of the server's tools: names, required parameters and the four hints. A copy of threadify-app's `docs/plugin/tool-contract.json`, which the server exports from the tool list it serves (threadify-app#252). |
| `contract/terms.json` | Backticked snake_case words in the package that are not tools (parameters, statuses, memory classes). |
| `SUBMISSION.md` | The owner's checklist: steps only the owner or lead engineer can take, reviewer notes and the demo video outline. |
| `tests/` | `node --test` suites and small fixture packages. |

## How the build edits a skill

For each selected skill, the build copies the generated `skills/<name>/` tree and then:

1. Removes files matching `drop` globs. A glob that matches nothing fails the build.
2. Rewrites the `description` line in the `SKILL.md` front matter.
3. Applies each `replace` rule. The `find` text must appear exactly once, or the build fails. This catches upstream wording changes instead of shipping a stale edit.
4. Adds files from `add`. It never overwrites a file that already exists.

A skill with `"override": "overrides/<name>"` ships the files in that folder instead of the upstream ones, then gets the same description rewrite and `add` files. The override folder must carry the skill's own name, and `drop` or `replace` rules on an override fail the build. The upstream files stay in the lock as inputs, so `--check` still names an upstream change and the rewrite gets reviewed against it.

JSON output uses sorted keys and fixed formatting, so the same inputs always produce the same bytes.

## Build, check and test

From the repository root, using Node 18 or newer, with no install step:

```sh
node editions/listed/build.mjs            # regenerate package/ and package.lock.json
node editions/listed/build.mjs --check    # fail if the committed package or lock is stale
node editions/listed/preflight.mjs editions/listed/package/threadify          # human-readable
node editions/listed/preflight.mjs editions/listed/package/threadify --json   # machine-readable
node --test editions/listed/tests/*.test.mjs
```

Before an upload, the owner also runs:

```sh
node editions/listed/preflight.mjs editions/listed/package/threadify --final --online
```

- `--final` refuses placeholders (the demo video link starts as an `example.com` PLACEHOLDER) and a missing review packet, and warns when `publication.countries` is `[]`, which means no country restriction.
- `--online` fetches the website, support, privacy and terms URLs and `/.well-known/openai-apps-challenge` on the MCP host, signed out. Each must answer 200 with no redirect; support must show an email address; privacy and terms must show their titles; the challenge must be a bare token. It reads production pages, so CI never runs it. The support URL is `listing.supportURL` in `edition.json`; it points at the public `/help` page from threadify-app#231 rather than the signed-in `/support`.

When a source skill changes upstream, `--check` names the changed input. Review the change against the `replace` rules, run the build, and commit the regenerated package.

Preflight findings use OpenAI's code names from [Plugin submission errors](https://developers.openai.com/plugins/deploy/submission-errors) where one exists. Codes starting with `listed_` are ours. Two of them guard real behavior: Codex quietly ignores an `mcp.json` server without the `$schema` field or without `type: "streamable-http"`. The `listed_policy_*` codes enforce our listing policy. The only text the policy lint skips is a negative review case's `prompt`, because it quotes what a person might ask.

`listed_tool_unknown` fires on a backticked snake_case word that is not a tool, a required parameter of one, or a word in `contract/terms.json`. `listed_tool_required_param_missing` fires when a skill names a tool but never names one of its required parameters, such as `get_schedule_status` without `scheduled_post_id`. Every `tools_triggered` name in the review cases must be a real tool too.

`tests/skills.test.mjs` pins the three hand-written skills to their tools. Each may name only its listed tools, in order: Get Set Up and Create My Week call `review_post` before `schedule_post`, and Inbound Replies calls `review_reply` before every send tool. None of them names `publish_now` or `set_automation_preference`, and Get Set Up names no reply tool.

To refresh the contract after the server's tools change:

```sh
git -C ../threadify-app show origin/main:docs/plugin/tool-contract.json > editions/listed/contract/tools.json
```

The `listed-edition` GitHub workflow runs the check, the preflight and the tests on every pull request.

## Test the plugin in Codex

Use a scratch Codex home so your real `~/.codex` is never touched:

```sh
export CODEX_HOME="$(mktemp -d)" HOME="$(mktemp -d)"
codex plugin marketplace add "$PWD/editions/listed/package"
codex plugin add threadify@threadify-listed-local
codex plugin list --json          # threadify@threadify-listed-local is installed and enabled
codex mcp list                    # the threadify server appears
codex debug prompt-input "hi"     # the twelve threadify:threadify-* skills are listed
codex plugin remove threadify@threadify-listed-local
codex plugin marketplace remove threadify-listed-local
```

The marketplace path must be absolute or start with `./`. Signing in to the Threadify server (`codex mcp login`) is a separate step and is not needed for this install check.
