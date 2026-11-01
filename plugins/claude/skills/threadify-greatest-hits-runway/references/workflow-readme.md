# Greatest Hits Runway

If no setup choice is known, ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md). Honor an existing choice.

Use the complete [installable skill](../../skills/threadify-greatest-hits-runway/SKILL.md). The source skill is bundled unchanged, along with its local references.

Local preparation needs only approved inputs. Connected operations require current tool schemas, account verification, exact action approval and readback. See the skill for fallback and uncertainty handling. No live customer outcomes are established by the public package.

## Portable local review

Run `node bin/threadify-workflows.mjs greatest-hits review --input /private/input.json --output-dir /private/new-review` from a complete repository installation. The [input contract and synthetic example](../../plugins/threadify/skills/threadify-greatest-hits-runway/references/local-review.md) cover policy, full-chain hydration and live calendar coverage. This local helper preserves queued positions, evaluates the remaining slots individually and leaves truthful gaps for missing evidence. It exports complete copy and media references to a responsive, read-only HTML page plus a private JSON packet.

The page cannot approve or schedule. A fingerprint identifies exact copy/media/source/time; the owner's chat approval, current provider validation and live readback remain required. In standalone skill installs without the CLI, follow the same contract manually. Keep real input/output outside the public checkout.

Regression checks: `npm run test:greatest-hits`. No provider account, posting credentials or personal source corpus is needed.
