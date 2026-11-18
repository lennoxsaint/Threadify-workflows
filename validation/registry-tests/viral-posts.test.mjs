import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-viral-posts/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/viral-posts/manifest.json'), 'utf8'));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sameText = (text) => (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
// one fill: same text after case, punctuation and spacing, or differing only in a number (SKILL.md step 2)
const sameFill = (text) => sameText(text).replace(/\p{N}+/gu, '#');
// When more than one label applies, the first in this order shows and the rest are also_labels (SKILL.md step 2).
const SMALL_WORDS = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'of', 'to', 'in', 'on', 'for', 'at', 'by', 'with', 'from', 'and', 'or', 'but', 'not', 'no', 'so', 'too', 'very', 'i', 'you', 'we', 'my', 'your', 'our', 'it', 'its', 'this', 'that', 'all', 'every', 'he', 'she', 'they', 'them', 'me', "i'm", "it's", 'do', "don't", 'does', 'has', 'have', 'can', 'will', 'just', 'more', 'most', 'than', 'what', 'about', 'how', 'when', 'if'];
const LABEL_ORDER = ['shape_unverified', 'media_unknown', 'needs_media', 'unproven', 'tired', 'control_failed', 'no_fitting_fact'];
const longestFixedRun = (skeleton) => skeleton.split(/\[[^\]]*\]/)
  .map((run) => run.replace(/[^\p{L}\p{N}'’"“”\s]+/gu, ' ').trim().split(/\s+/).filter(Boolean))
  .reduce((best, run) => (run.length > best.length ? run : best), []);

// Search matches apostrophes and quote marks exactly, so a stretch with one is searched as written, then all straight
// and all curly, skipping a repeat (SKILL.md step 2).
const allStraight = (query) => query.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const allCurly = (query) => { let open = true; return allStraight(query).replace(/'/g, '’').replace(/"/g, () => ((open = !open) ? '”' : '“')); };
const tiredQueries = (query) => (/['"‘’“”]/.test(query) ? [...new Set([query, allStraight(query), allCurly(query)])] : [query]);

// The verdict is the reader's own DELIVERS word, and the result follows from it, never the other way round (SKILL.md rule 4).
const readerVerdict = (record, where) => {
  assert.ok(record?.reader && record.answer, `${where} records who read it and the answer`);
  const said = [...record.answer.matchAll(/DELIVERS: (clear yes|borderline|no)\b/g)].map((match) => match[1]);
  assert.equal(said.length, 1, `${where} answer has exactly one DELIVERS line`);
  assert.match(record.answer, /KIND: (promises more|complete claim)\b/, `${where} answer has a KIND line`);
  assert.equal(record.verdict, said[0], `${where} verdict is the DELIVERS word from its answer`);
  return said[0];
};

function assertFreshReaders(receipt) {
  const firstGenerate = receipt.tool_path.indexOf('generate_content');
  const waiverFor = (templateId) => {
    const waiver = receipt.templates.find((t) => t.template_id === templateId)?.fresh_reader_waiver;
    return waiver?.template_id === templateId ? waiver : null;
  };
  for (const template of receipt.templates.filter((t) => t.status === 'used' || t.status === 'control_failed')) {
    const control = template.fresh_reader_control;
    const verdict = readerVerdict(control, `${template.template_id} control`);
    assert.equal(control.evidence_first_line, template.evidence.reduce((best, e) => (e.views > best.views ? e : best)).first_line,
      `${template.template_id} control is its most-viewed evidence post`);
    if (firstGenerate >= 0) assert.ok(control.after_tool_calls <= firstGenerate, `${template.template_id} control ran before any generate_content`);
    const expected = /^self-read/.test(control.reader) ? 'unavailable' : verdict === 'clear yes' ? 'pass' : 'fail';
    assert.equal(control.result, expected, `${template.template_id} control result follows its reader and verdict`);
    const waived = Boolean(template.fresh_reader_waiver);
    if (waived) {
      assert.equal(template.fresh_reader_waiver.template_id, template.template_id, `${template.template_id} waiver names its own template`);
      assert.ok(template.fresh_reader_waiver.creator_words && template.fresh_reader_waiver.at, 'the waiver keeps the creator\'s words and when');
    }
    if (control.result === 'fail') {
      assert.equal(template.status === 'used', waived, `${template.template_id} is used after a failed control only with a waiver`);
    } else {
      assert.ok(!waived, `${template.template_id} needs no waiver when its control is ${control.result}`);
    }
    if (template.status === 'control_failed') {
      assert.ok(!(receipt.gate_drafts ?? []).some((draft) => draft.template_id === template.template_id), `${template.template_id} saves no draft`);
      assert.ok(!(receipt.posts ?? []).some((post) => post.template_id === template.template_id), `${template.template_id} makes no post`);
    }
    // the waiver label follows the post's own result: a post its reader passed carries no failure label
    const resultFor = (post) => post.fresh_reader?.result ?? (receipt.checks ?? []).find((c) => c.template_id === post.template_id)?.fresh_reader?.result;
    for (const post of (receipt.posts ?? []).filter((p) => p.template_id === template.template_id && waived && p.state !== 'excluded')) {
      const line = `fresh reader: fail, waived by you for ${template.template_id} (your words: "${template.fresh_reader_waiver.creator_words}")`;
      if (resultFor(post) === 'fail, waived') assert.ok(post.gate_flags?.includes(line), `${template.template_id} shows the waiver at the gate`);
      else assert.ok(!(post.gate_flags ?? []).some((flag) => flag.startsWith('fresh reader: fail')), `${template.template_id} shows no failure label on a post its reader passed`);
    }
  }
  const rows = [...(receipt.checks ?? []).map((row) => ['check', row]), ...(receipt.posts ?? []).filter((post) => post.fresh_reader).map((row) => ['post', row])];
  for (const [kind, row] of rows) {
    const where = `${row.template_id} ${kind}`;
    const verdict = readerVerdict(row.fresh_reader, where);
    // a self-read is never a pass: a clear yes is unavailable, a borderline or no is a fail (SKILL.md rule 4)
    const expected = /^self-read/.test(row.fresh_reader.reader) ? (verdict === 'clear yes' ? 'unavailable' : 'fail')
      : verdict === 'clear yes' ? 'pass' : waiverFor(row.template_id) ? 'fail, waived' : 'fail';
    assert.equal(row.fresh_reader.result, expected, `${where} result follows its reader, verdict and waiver`);
    if (expected === 'fail') {
      const post = kind === 'post' ? row : (receipt.posts ?? []).find((p) => p.template_id === row.template_id);
      assert.ok(!post || post.state === 'excluded', `${where} failed its fresh reader and is never proposed`);
    }
    if (expected === 'unavailable') {
      assert.equal(row.gate_line, `fresh reader: unavailable (self-read: ${row.fresh_reader.answer})`, 'the gate shows the self-read');
    }
    assert.ok(!('fresh_reader_delivers' in row), 'a bare true is not a fresh-reader record');
  }
}

test('Viral Posts registers only Threadify read, generate, validate and schedule tools', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'viral-posts');
  assert.equal(workflow.skill_name, 'threadify-viral-posts');
  assert.equal(workflow.title, 'Viral Posts');
  const tools = [...workflow.required_mcp_tools, ...(workflow.optional_mcp_tools ?? [])];
  for (const tool of [
    'get_connection_defaults', 'greatest_hits', 'search_posts', 'read_post_performance', 'get_post_thread',
    'list_viral_items', 'get_viral_item', 'query_brain', 'generate_content', 'validate_post',
    'best_time_to_post', 'list_scheduled_posts', 'schedule_post', 'get_schedule_status',
  ]) {
    assert.ok(tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of [
    'publish_now', 'save_draft', 'edit_draft', 'cancel_schedule', 'reschedule_post', 'send_reply',
    'create_offer', 'update_offer', 'remember', 'correct_memory', 'tombstone_memory', 'record_feedback',
  ]) {
    assert.ok(!tools.includes(tool), `must not use ${tool}`);
  }
  assert.equal(manifest.approval_gate.required, true);
  assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
  assert.ok(manifest.approval_gate.must_show.includes('exact text of every part of every post'));
  assert.ok(manifest.approval_gate.must_show.includes('exact time and timezone for every post'));
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
  assert.ok(manifest.receipt.must_prove.includes("fallback repeat check: per claim word, the pasted posts that have it, and the creator's own search (creator_search) or no answer"));
  assert.ok(manifest.receipt.must_prove.includes('readback status (scheduled, never published)'));
  assert.ok(manifest.triggers.includes('viral posts'));
});

test('Viral Posts keeps the creator lessons as rules', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Copy the proven skeleton line for line/);
  assert.match(skill, /80 characters or less/);
  assert.match(skill, /voice and energy of the creator's own top posts/);
  assert.match(skill, /fresh-reader check/);
  assert.match(skill, /Show every part of a thread/);
  assert.match(skill, /Label each template you pick "used", even when none of its drafts survives the checks/);
  assert.match(skill, /Without a connection, `account_handle` is the handle the creator gave you, or `unconnected`/);
  assert.match(skill, /A word is a \*\*fixed word\*\* only when every evidence post has it in the same place: the same word count from the start of the line, or from its end/);
  assert.match(skill, /A shared word that moves around inside the fills stays inside a placeholder/);
  assert.match(skill, /`limit` and `after_tool_calls` \(the number of `tool_path` entries made before you counted, never past the first `generate_content`\)/);
  assert.match(skill, /Make up to two versions per template \(one call each, for example with a different style preset\), give each only facts that fit, and keep the draft id each call returns and the fact it was given/);
  assert.match(skill, /count the hook fit as in step 3 \(record `hook_fit`; a template with no fitting fact is labelled "no fitting fact" and gets no post\)/);
  assert.match(skill, /find them with the same stretch of fixed words and quote-mark forms as step 2, and record those stretches as `tired_check_queries`/);
  assert.match(skill, /A template with none of the labels above is "eligible"\. Step 3 labels the ones it picks "used"/);
  assert.match(skill, /Before any `generate_content` call, fill the hook yourself with each fact in its exact Brain wording and count the characters/);
  assert.match(skill, /When no fact fits, relabel the template "no fitting fact", leave it out and make no `generate_content` call for it/);
  assert.match(skill, /A shortening that drops a word the sentence needs, such as an article or a verb, also fails/);
  assert.match(skill, /If you would ask the creator to confirm the fix, it fails/);
  assert.match(skill, /naming `account\.username` as the only account this run reads and writes/);
  assert.match(skill, /This run opens at most 3 library posts: name that number in the drafting-yes ask/);
  assert.match(skill, /pass it as `idempotency_key`\. If a call errors or times out, retry only with that same key/);
  assert.match(skill, /Every slot must be at least 5 minutes in the future/);
  assert.match(skill, /A slot that is now less than 5 minutes away is blocked: it needs a new time and a new yes/);
  assert.match(skill, /record your answer word for word with its `DELIVERS:` word as the verdict and `unavailable` as the result/);
  assert.match(skill, /Never invent a number, quote, name or story/);
  assert.match(skill, /`approved_text` is a list of every part of every approved post, in order: `\[\]` until the creator's yes at the gate, with `approved_text_sha256` set to `none-awaiting-approval`/);
  assert.match(skill, /Until they tell you the total, do the same, and say at the gate which labels would change if the line were higher/);
  assert.match(skill, /\(with no times given, propose none and ask for them\)/);
  assert.match(skill, /or it is not what the placeholder names, such as a fact about sleep in a slot for a money lesson/);
  assert.match(skill, /a self-read of `borderline` or `no` is a fail, so only a post you read as a clear yes is shown as \"unavailable\"/);
  assert.match(skill, /no line after the hook is longer, in characters, than the longest version of that line among the template's evidence posts/);
  assert.match(skill, /These positions only find the skeleton: a new fill may have any number of words/);
  assert.match(skill, /Also skip a fact that already fails a step-4 check before any call/);
  assert.match(skill, /A paste that gives only each post's first part leaves every post cut off until its full text, or the creator's word that it had one part, comes in/);
  assert.match(skill, /`fallback_ready` \(the local fallback, whether or not any post survives;/);
  // round 12: repeats of the creator's own posts, case and closing mark, label order, fact_kept
  assert.ok(skill.includes(`**Repeat check:** for each fact that fits, its claim words are every word of the fact except the template's fixed words and these small words: ${SMALL_WORDS.join(', ')}. Call \`search_posts\` once for each claim word, on its own`), 'the skill lists the same small words as the test');
  assert.match(skill, /: a phrase misses a post that makes the same claim in other words\. Get every match, as in the tired check, read each one for the claim, and stop once one makes it\./);
  assert.match(skill, /A word with more than 200 matches is too broad to read in full: read only the matches where that word starts a claim .*?, and read every match of at least one other claim word in full\./);
  assert.match(skill, /If you cannot get every match of a word, or the fact's only claim word is that broad, its repeat check is incomplete: leave the fact out, with `skipped` set to `repeat check incomplete`\./);
  assert.match(skill, /`searches`, in order, each with its `word`, `total` \(its `total_matched`\), `returned` \(the posts you got, after any paging\), `read` \(the ones you read for the claim\) and, when `read` is under `returned`, `narrowed_by`/);
  assert.match(skill, /for a fact that passes, `closest`, the post that came nearest \(date, views, its line and `why_not`, why its claim differs\), or `none`\. You decide whether a post makes the claim; never leave that call to the creator\./);
  assert.ok(skill.includes("(it is followed by is, isn't, are, aren't, was, will, won't, can, can't, do, don't, does, doesn't, has, have, should, makes or means)"), 'the narrowing verbs include are, do and have');
  assert.ok(skill.includes('then ask the creator to search their own posts for each claim word of each fact you will use and paste every match, or say there is none'), 'the fallback asks for the creator\'s own search');
  assert.match(skill, /record their answer as `creator_search` in that fact's `repeat_check`, or `no answer`; with no answer, show "repeat check: pasted posts only" on that post at the gate and record it as that post's `repeat_gate_line`/);
  assert.match(skill, /with the version's first line as `hook` so the label can be checked against it\./);
  assert.match(skill, /record each fact as one row of the template's `hook_fit` in the receipt, with its `fact`, `filled_hook`, `filled_hook_chars` \(the count\), `limit` and `after_tool_calls`/);
  assert.match(skill, /Record on that fact's `hook_fit` row its `repeat_check`: `searches`/);
  assert.match(skill, /If a raised limit still brings back fewer, search again with `to` set to the oldest date that came back and merge the results by post id, until you hold every match\./);
  assert.match(skill, /A fact whose claim one of the creator's own posts already makes, in any template or in none, is a repeat/);
  assert.match(skill, /and so is a fact whose claim one of the creator's own posts already makes, in any template or in none \(the step-3 repeat check\)/);
  assert.match(skill, /run the step-3 repeat check on every pasted post instead of `search_posts`, looking for the same claim words one at a time \(record `repeat_check` with `in` set to `pasted posts` and, per word, the pasted posts that have it as its `total`, `returned` and `read`/);
  assert.match(skill, /the fact keeps its words and their order, while its letter case and closing mark follow the template/);
  assert.match(skill, /except a word the creator writes in capitals, such as AI, and the fact's own closing mark gives way to the skeleton's, never doubled/);
  assert.match(skill, new RegExp(`the template carries the first of them in this order: ${LABEL_ORDER.map((label) => label.replace(/_/g, ' ')).join(', ')}\\. Show the others next to it as "also: <labels>" and record them, in that order, as \`also_labels\``));
  assert.match(skill, /Record whether each version's text keeps that fact as `fact_kept`: `word for word` \(letter case and the closing mark aside\), `shortened`/);
  assert.match(skill, /its `repeat_check` and any `skipped` check\)/);
  assert.doesNotMatch(skill, /the older i get/, 'the example stem is a neutral one');
  assert.match(skill, /top 10% by views at least twice/);
  assert.match(skill, /view count/);
  assert.match(skill, /three most recent uses by date/);
  assert.match(skill, /Label it "tired"/);
  assert.match(skill, /10 most recent posts with view counts/);
  assert.match(skill, /"tired check incomplete"/);
  assert.match(skill, /Only `DELIVERS: clear yes` passes; `borderline` and `no` fail/);
  assert.match(skill, /DELIVERS: <exactly one of: clear yes \| borderline \| no>/);
  assert.match(skill, /KIND: <exactly one of: promises more \| complete claim>/);
  assert.match(skill, /one complete observation or claim that promises nothing more, it delivers when you understand the whole claim without knowing the author/);
  assert.match(skill, /its verdict: the word after `DELIVERS:`, copied from that answer, never your own summary of it/);
  assert.match(skill, /Judge honestly\. "clear yes" only if the post fully gives you what its opening promised without needing to know the author\./);
  assert.match(skill, /The `KIND` line keeps one-line posts fair: a hook that promises more must get it in the rest of the post, while one complete claim passes when a stranger understands it, with no reason needed/);
  assert.match(skill, /Your own read is never a pass: when no fresh agent or session is available, the check is \*\*unavailable\*\*/);
  // round 9: facts keep the link between their parts, one hand fix, the writer gets the limit and the exact words
  assert.match(skill, /changing who or what it is about, or the link between its parts \("is the secret to" becoming "is", "leads to" becoming "equals"\), makes a new claim, and that fails/);
  assert.match(skill, /Fix it by hand at most once, and only when the fix keeps the skeleton and the facts \(for example a shorter hook\), then check again and say what changed\. If you would ask the creator to confirm the fix, it fails\. If the fixed post still fails, drop it\./);
  assert.match(skill, /the hook's character limit \(80, or the proven hook's length when that is longer\), each fact in its exact Brain wording, and the rule "keep this skeleton exactly; change only the placeholder words; keep each fact's words and the link between them"/);
  assert.match(skill, /record every query you searched, in order, as the template's `tired_check_queries` in the receipt, or an empty list when there is no stretch to search/);
  assert.match(skill, /and only when drafting will go ahead: a run without the drafting yes stops after the tired check, with no control and no waiver question/);
  assert.match(skill, /run the step-2 control before you fill any \(with no fresh agent it is unavailable and no waiver is asked; with one, the control and waiver work as in step 2\)/);
  assert.match(skill, /search it as written, then with every mark straight \(`'` `"`\) and with every mark curly \(`’` `“` `”`\), skipping a form you already searched, and merge the results/);
  assert.match(skill, /read in full: every part of a thread, no cut-off text/);
  assert.match(skill, /Label the template "needs media"/);
  assert.match(skill, /sort_by: "recent"/);
  assert.match(skill, /give it only this prompt, with the post's full text in place of `\{POST\}`/);
  assert.match(skill, /ranked at a tenth of that total/);
  assert.match(skill, /"media unknown"/);
  assert.match(skill, /reads at the energy of its evidence posts/);
  assert.match(skill, /A shape seen only in the library is "unproven" for this creator/);
  assert.doesNotMatch(skill, /library post with clear engagement/);
  assert.match(skill, /Leave out every template labelled unproven, tired, needs media, media unknown, shape unverified or control failed/);
  assert.match(skill, /"tired check incomplete" template may be used only with that flag shown next to it at the gate/);
  assert.match(skill, /a tenth of that count, rounded down/);
  assert.match(skill, /Writing it again needs a new drafting yes/);
  assert.doesNotMatch(skill, /fix it \(or write it again\)/);
  assert.match(skill, /If the creator sends a post back with a note, change only what the note names and keep the skeleton/);
  assert.match(skill, /flat or boring, or rejects the skeleton, switch to another eligible template/);
  assert.match(skill, /the longest stretch of fixed words between placeholders \(most words; the first on a tie\), as written in the evidence posts/);
  assert.match(skill, /Keep only the returned posts whose text fits the skeleton/);
  assert.match(skill, /no stretch of at least two fixed words, the search cannot find its uses: label it "tired check incomplete"/);
  assert.doesNotMatch(skill, /fixed words up to the first placeholder/);
  assert.match(skill, /`account\.username` with no @; use that same form in every fingerprint and key/);
  assert.match(skill, /at least twice, with two different fills/);
  assert.match(skill, /a reposted or recycled post counts once/);
  assert.match(skill, /only a plug \(a link or a call to action\) that the other evidence posts do not have, the template is the parts they share/);
  assert.match(skill, /never copy the plug/);
  assert.match(skill, /The filled-in words are new: they differ from every evidence post and every use found in the tired check/);
  assert.match(skill, /per evidence post its first line, date, views, media type, part count, fill and whether its text was complete/);
  assert.match(skill, /If `get_post_thread` fails for an evidence post, its text is not read in full: label the template "shape unverified". If it returns no `media_type`, label the template "media unknown"/);
  assert.match(skill, /A reposted copy counts as a use here, because the audience saw it again/);
  assert.match(skill, /ranked at a tenth of that total, rounded down and at least 1/);
  assert.match(skill, /a tenth of that count, rounded down and at least 1 \(rank 120 of 1,200; rank 1 for 1 to 19 posts\)/);
  assert.match(skill, /If `total_matched` is 0, there is nothing to copy: say so and stop before drafting/);
  assert.match(skill, /If they have published none, there is nothing to copy: say so and stop/);
  assert.match(skill, /or that differ only in a number such as an age or a year, are one fill/);
  assert.match(skill, /Each check is pass or fail: "pass with a flag" or "the creator should confirm" is a fail/);
  assert.match(skill, /this holds even when more uses may be hidden/);
  assert.match(skill, /recent posts with no text cannot show a use, so they count as missing/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /its evidence posts: per post its first line, date, views, media type, part count, fill and whether its text was complete/);
  assert.match(gate, /every draft saved so far, by id, each marked proposed, excluded or not picked/);
  assert.match(gate, /each template with its label, the top 10% line it beat, and its evidence posts/);
  assert.match(gate, /for a tired template, the view counts of its last three uses/);
  assert.match(gate, /each pass or fail, with the hook's length against its limit \(for example 78\/81 when the proven hook is 81 characters\), the energy reason and the fresh reader's answer; a waived check reads "fresh reader: fail, waived by you for <template-id> \(your words: "\.\.\."\)"/);
  assert.match(gate, /for each template, its control \(the fresh reader's answer on its most-viewed evidence post\) and any waiver, in the creator's words/);
  assert.match(gate, /per template its hook fit: each fact, its filled hook and its length against the limit, its repeat check \(each claim word with its match count and any narrowing, then the post that already makes the claim or the closest one\), and every fact left out before drafting, with the check it failed \(too long, a repeat of one of the creator's posts, a repeat check incomplete, or another step-4 check\)/);
  for (const line of ['per template its hook fit (each fact, its filled hook and its length against the limit), its repeat check (each claim word with its match count and any narrowing, then the matching or closest post) and every fact left out before drafting, with the check it failed, and, in the fallback with no creator search, "repeat check: pasted posts only" on that post',
    'any other label that applies to a template, shown next to it as also']) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  for (const line of ["repeat check per fitting fact: each claim word searched on its own with search_posts (or in the pasted posts), with its total, the posts returned and read, and the rule when a word with more than 200 matches is narrowed; the posts that already make its claim and the word that found them; for a fact that passes, the closest post or none; a fact with a match is skipped, and one whose matches could not all be read is left out as repeat check incomplete",
    'fact_kept per saved draft: word for word, shortened or changed, with the draft first line it was judged on']) {
    assert.ok(manifest.receipt.must_prove.includes(line), line);
  }
  assert.match(skill, /\*\*Calibrate the fresh-reader check\*\* before any `generate_content` call/);
  assert.match(skill, /Until they waive it, label the template "control failed" and leave it out/);
  assert.match(skill, /A waiver covers that template in this run only, and it is not a yes to schedule: the post still needs the yes at the gate/);
  assert.match(skill, /A fix that drops the creator's own swear words or intensifiers from a fact fails\. Record a one-line reason for every energy result/);
  assert.match(skill, /`status` is exactly one of: `awaiting_approval`/);
  assert.ok(manifest.approval_gate.must_show.includes("for each template, the fresh-reader control on its most-viewed evidence post and any waiver in the creator's words"));
  assert.ok(manifest.receipt.must_prove.includes("fresh-reader controls on evidence posts, run before any generate_content call, and any waiver (template, the creator's words, when; this run only)"));
  for (const line of ['the top 10% line each template beat', 'any plug part left out of a template', "for a tired template, its last three uses' view counts",
    "check results per post (each pass or fail, hook length against its limit, the energy reason, the fresh reader's answer, a waived check as fail, waived, a fresh reader marked unavailable with the self-read answer), intent fingerprint and stable idempotency key"]) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  for (const line of ['plug parts left out per template', 'fresh reader per post: who read it, its answer word for word and its verdict (the DELIVERS word from that answer)',
    'approved time written YYYY-MM-DDTHH:mm:ss±hh:mm (no milliseconds, never Z)', 'energy reason per post',
    'receipt status: one of awaiting_approval, nothing_to_approve, drafting_declined, fallback_ready, scheduled, partially_scheduled, schedule_unverified',
    'tired-check queries per template, every query searched, in order: as written, all straight and all curly when the stretch has an apostrophe or quote mark',
    "hook fit per template picked for drafting: each fact, its filled hook, the length and the limit, with after_tool_calls at or before the first generate_content call; each saved draft names a fact that fits"]) {
    assert.ok(manifest.receipt.must_prove.includes(line), line);
  }
  for (const line of ['template, its label and its evidence posts: per post its first line, date, views, media type, part count, fill and whether its text was complete',
    'every draft already saved by generation, by id, marked proposed, excluded or not picked']) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  const readme = fs.readFileSync(path.join(root, 'workflows/viral-posts/README.md'), 'utf8');
  assert.match(readme, /It writes text posts only: a template that went viral with a picture or video is shown but left out/);
  assert.match(readme, /except Threadify's validator \(the 500-character rule is checked by hand\) and the repeat check, which sees only the posts you paste/);
  assert.match(readme, /you see that post and the reader's answer/);
  assert.doesNotMatch(readme, /you see both/);
  assert.match(readme, /a check that its fact is not a claim one of your own posts already made/);
});

test('Viral Posts shows and rechecks the global auto-repost setting and full queued text', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /`automation\.global_auto_repost`/);
  assert.match(skill, /it is unknown, never off/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /the global auto-repost setting exactly as read/);
  assert.match(gate, /This workflow never changes it/);
  assert.match(gate, /nothing can be scheduled until the creator checks it/);
  assert.match(gate, /saved draft <id> keeps the old wording/);
  const step7 = skill.slice(skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(step7, /a changed or unknown setting blocks every post until a new yes/);
  assert.match(step7, /the per-post `auto_repost`; the creator's global auto-repost setting still applies/);
  assert.match(skill, /preview ends in "…" or that has more than one part, call `get_schedule_status` once for its full text/);
  assert.match(skill, /the comparison is unresolved: no post is proposed until it is fetched/);
  assert.match(step7, /at every dispatch, fetch the full text again with `get_schedule_status` for every queued post whose preview ends in "…" or that has more than one part/);
  assert.match(step7, /never reuse text fetched earlier/);
  assert.doesNotMatch(step7, /for any id whose preview or part count changed/);
  assert.match(skill, /Without it, skip `list_viral_items`, `get_viral_item` and every later save/);
  assert.match(skill, /After the drafting yes only, call `list_viral_items`/);
  assert.match(skill, /it is empty only when no tool was called/);
  for (const line of ['global auto-repost setting as read (on with its trigger, off or unknown)', 'each hand-fixed post: the saved draft keeps the old wording']) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  assert.ok(manifest.receipt.must_prove.includes('global auto-repost setting at the gate and at each dispatch'));
});

test('Viral Posts discloses saves before drafting and guards the write after the yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const saves = skill.indexOf('## What the run saves before any schedule');
  assert.ok(saves > 0 && saves < skill.indexOf('## Steps'), 'saves are disclosed before the steps');
  assert.match(skill, /saves one draft and one chat in the account and uses one generation/);
  assert.match(skill, /uses one viral allowance/);
  assert.match(skill, /it never covers scheduling/);
  const step7 = skill.slice(skill.indexOf('7. **Schedule after the yes.**'));
  const recheck = step7.indexOf('**Recheck.**');
  const intent = step7.indexOf('**Save the intent first.**');
  const write = step7.indexOf('`schedule_post`');
  assert.ok(recheck >= 0 && recheck < intent && intent < write, 'recheck and saved intent come before the write');
  assert.match(step7, /`list_scheduled_posts` again for a window that starts at least 2 hours before this post's slot/);
  assert.match(step7, /Never move an approved time yourself/);
  assert.match(step7, /the approved time as an ISO instant/);
  assert.match(step7, /written `YYYY-MM-DDTHH:mm:ss±hh:mm` in the creator's timezone \(no milliseconds, never `Z`/);
  assert.match(step7, /`scheduled_at` as that same approved time string/);
  assert.match(step7, /`\[account, parts, media, scheduled_at\]` \(as `JSON\.stringify` writes it\)/);
  assert.match(step7, /they must equal what the gate showed/);
  assert.match(step7, /Never pass `draft_id`: a saved draft can be edited after the gate, and the tool does not say which text wins/);
  assert.doesNotMatch(skill, /Threadify schedules a draft's stored text/, 'no unproven claim about draft_id');
  assert.match(step7, /`posts` as `\[\{"text": \.\.\.\}\]` objects, one per part in order, or `text` for a single post/);
  assert.match(step7, /`account` as the account from step 1/);
  assert.doesNotMatch(step7, /pass its `draft_id`/);
  assert.match(step7, /as plain strings \(not `\{text\}` objects\)/);
  assert.match(step7, /Leave out `platforms` \(so it goes to Threads only\), `auto_plug` and the per-post `auto_repost`/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /fingerprint and stable idempotency key/, 'the gate shows what the yes binds');
  assert.match(step7, /the result is unknown/);
  assert.match(step7, /its status shows the post queued/);
  assert.match(skill, /label that template "shape unverified" and leave it out of the batch/);
});

test('Viral Posts keeps the tool order, calendar check and approval gate', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const steps = skill.slice(skill.indexOf('## Steps'));
  const order = ['get_connection_defaults', 'greatest_hits', 'get_post_thread', 'list_viral_items', 'query_brain',
    'generate_content', 'validate_post', 'best_time_to_post', 'list_scheduled_posts', 'schedule_post', 'get_schedule_status'];
  let last = -1;
  for (const tool of order) {
    const at = steps.indexOf(`\`${tool}\``, last + 1);
    assert.ok(at > last, `${tool} appears in workflow order`);
    last = at;
  }
  assert.match(skill, /must equal its `total_in_window`/);
  assert.match(skill, /at least 2 hours clear/);
  assert.match(skill, /no new post repeats text already queued/);
  assert.match(skill, /Nothing is scheduled without it/);
  assert.match(skill, /Never route around it/);
  assert.match(skill, /stable idempotency key/);
  assert.match(skill, /never make a new key to force a second write/);
  assert.match(skill, /"scheduled", never "published"/);
  assert.match(skill, /## Local fallback/);
  assert.match(skill, /## Receipt/);
  assert.match(skill, /references\/threadify-001\.md/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.doesNotMatch(skill, /craft_viral_post/, 'the ChatGPT address does not list craft_viral_post');
  assert.doesNotMatch(skill, /—/, 'no em dashes in user-facing text');
});

test('Viral Posts README and bundled skill stay in step with the source', () => {
  const readme = fs.readFileSync(path.join(root, 'workflows/viral-posts/README.md'), 'utf8');
  assert.match(readme, /\/threadify-viral-posts/);
  assert.match(readme, /never publishes now/i);
  assert.doesNotMatch(readme, /—/);
  const bundled = fs.readFileSync(path.join(root, 'skills/threadify-viral-posts/SKILL.md'), 'utf8');
  assert.ok(bundled.startsWith(fs.readFileSync(source, 'utf8').trimEnd()), 'bundled skill starts with the source skill');
  assert.match(bundled, /references\/demo-feedback-rules\.md/);
});

test('Viral Posts manifest fallback mirrors the skill fallback sentence by sentence', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const paragraph = skill.slice(skill.indexOf('## Local fallback')).split('\n\n')[1].trim();
  assert.ok(paragraph.startsWith('Without a working connection'), 'the fallback paragraph is found');
  assert.ok(manifest.fallback.instructions.join(' ').startsWith(paragraph), 'the manifest fallback starts with the skill fallback, word for word');
  assert.ok(manifest.fallback.instructions.length > paragraph.split('. ').length / 2, 'one instruction per sentence');
  assert.match(manifest.fallback.instructions.at(-1), /tool_path/, 'and keeps the tool_path rule');
});

test('Viral Posts receipt fixtures match the workflow receipt schema', () => {
  const validate = new Ajv({ strict: false }).compile(readJson('schemas/workflow-receipt.v1.json'));
  const pending = readJson('validation/mock-fixtures/viral-posts.awaiting-approval.receipt.json');
  const fallback = readJson('validation/mock-fixtures/viral-posts.fallback.receipt.json');
  assert.equal(fallback.account_handle, 'unconnected');
  for (const receipt of [pending, fallback]) {
    assert.ok(validate(receipt), JSON.stringify(validate.errors));
    assert.equal(receipt.workflow_id, 'viral-posts');
    assert.ok(!receipt.tool_path.includes('publish_now'));
    for (const template of receipt.templates.filter((t) => t.status === 'used')) {
      const hits = template.evidence.filter((post) => post.views >= receipt.top_10_line.views);
      assert.ok(new Set(hits.map((post) => sameFill(post.fill))).size >= 2, `${template.template_id} needs two different fills over the top 10% line`);
    }
  }
  assert.equal(pending.status, 'awaiting_approval');
  assert.deepEqual(pending.approved_text, []);
  assert.ok(!pending.tool_path.includes('schedule_post'), 'nothing is scheduled before the yes');
  assert.equal(pending.schedule_proposal.calendar_listed, pending.schedule_proposal.calendar_total_in_window);
  assert.equal(fallback.fallback_used, true);
  assert.deepEqual(fallback.tool_path, []);
  for (const name of ['awaiting-approval', 'drafting-declined', 'fallback', 'fallback-after-error']) {
    const receipt = readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`);
    assert.ok(validate(receipt), `${name}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(receipt.approved_text, [], `${name} has no approved text before a yes`);
    assert.equal(receipt.approved_text_sha256, 'none-awaiting-approval', name);
  }
});

test('Viral Posts fixtures keep cut-off, media, stale-calendar and unknown-write cases blocked or unverified', () => {
  const validate = new Ajv({ strict: false }).compile(readJson('schemas/workflow-receipt.v1.json'));
  const names = ['awaiting-approval', 'fallback', 'after-yes', 'drafting-declined', 'fallback-after-error'];
  const receipts = names.map((name) => readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`));
  for (const receipt of receipts) {
    assert.ok(validate(receipt), JSON.stringify(validate.errors));
    const line = receipt.top_10_line;
    assert.equal(line.rank, Math.max(1, Math.floor(line.account_post_count / 10)), 'the line is the post at a tenth of the count');
    const used = new Set([...(receipt.checks ?? []), ...(receipt.posts ?? [])].map((row) => row.template_id));
    const labels = ['used', 'eligible', 'unproven', 'tired', 'needs_media', 'media_unknown', 'shape_unverified', 'control_failed', 'no_fitting_fact'];
    // every label a receipt uses is one the manifest's receipt line names
    const labelLine = manifest.receipt.must_prove.find((line) => line.startsWith('label per template:'));
    assert.ok(labelLine.endsWith(`when several apply, the first in order (${LABEL_ORDER.map((label) => label.replace(/_/g, ' ')).join(', ')}) and the rest as also_labels`),
      'the manifest label line gives the order and also_labels');
    for (const template of receipt.templates) {
      assert.ok(labelLine.split(';')[0].includes(template.status.replace(/_/g, ' ')), `the manifest label line names ${template.status} in its own list`);
    }
    // the step-2 control runs only when drafting goes ahead
    if (receipt.status === 'drafting_declined') {
      assert.ok(receipt.templates.every((t) => !t.fresh_reader_control && !t.fresh_reader_waiver), 'a declined run has no control and asks no waiver');
    }
    const statuses = { awaiting_approval: 'schedule_post', nothing_to_approve: 'schedule_post', drafting_declined: 'evidence_only', fallback_ready: 'local_packet',
      scheduled: 'schedule_post', partially_scheduled: 'schedule_post', schedule_unverified: 'schedule_post' };
    assert.equal(receipt.action, statuses[receipt.status], `status ${receipt.status} is a listed one with its action`);
    assert.equal(receipt.fallback_used, receipt.status === 'fallback_ready');
    for (const template of receipt.templates) {
      assert.ok(labels.includes(template.status), `${template.template_id} has a known label`);
      assert.equal(template.top_10_percent_views, line.views);
      // every evidence label that applies, in order: the first is the label, the rest are also_labels
      const found = {
        shape_unverified: template.evidence.some((post) => post.source_complete !== true),
        media_unknown: template.evidence.some((post) => post.media_type === 'unknown'),
        needs_media: template.evidence.some((post) => !['TEXT_POST', 'unknown'].includes(post.media_type)),
        unproven: template.evidence.every((post) => typeof post.fill === 'string')
          && new Set(template.evidence.filter((post) => post.views >= line.views).map((post) => sameFill(post.fill))).size < 2,
        tired: template.tired_check?.last_three?.length === 3 && template.tired_check.last_three.every((use) => use.views < line.views),
      };
      const applies = LABEL_ORDER.filter((label) => found[label]);
      if (applies.length) {
        assert.deepEqual([template.status, ...(template.also_labels ?? [])], applies, `${template.template_id} carries the first label that applies and the rest as also_labels, in order`);
      } else {
        assert.ok(!(template.status in found), `${template.template_id} is ${template.status} with no evidence for it`);
        for (const label of template.also_labels ?? []) assert.ok(!(label in found), `${template.template_id} also ${label} with no evidence for it`);
      }
      const shown = [template.status, ...(template.also_labels ?? [])].filter((label) => LABEL_ORDER.includes(label));
      assert.deepEqual(shown, [...shown].sort((x, y) => LABEL_ORDER.indexOf(x) - LABEL_ORDER.indexOf(y)), `${template.template_id} labels follow the order`);
      if (template.tired_check) assert.equal(template.tired_check.recycled_copies, 'count as uses', 'a reposted copy counts as a use');
      for (const post of template.evidence) {
        for (const key of ['first_line', 'date', 'views', 'media_type', 'part_count', 'fill', 'source_complete']) {
          assert.ok(key in post, `${template.template_id} evidence shows ${key}`);
        }
        if (post.plug_part_left_out) {
          assert.match(template.gate_note ?? '', /plug is not copied/, `${template.template_id} shows the plug at the gate`);
          for (const draft of (receipt.posts ?? []).filter((p) => p.template_id === template.template_id)) {
            assert.ok(draft.parts.length < post.part_count, `${template.template_id} does not copy the plug part`);
          }
        }
      }
      if (template.status !== 'used') assert.ok(!used.has(template.template_id), `${template.template_id} stays out of the batch`);
      for (const flag of template.flags ?? []) assert.equal(flag, 'tired_check_incomplete', 'the only usable flag');
    }
    for (const check of receipt.checks ?? []) {
      assert.equal(check.energy_matches_evidence, true, `${check.template_id} reads at its evidence energy`);
      assert.equal(check.fill_is_new, true, `${check.template_id} does not repeat an evidence or tired-check fill`);
      assert.ok(check.energy_reason, `${check.template_id} gives a one-line energy reason`);
      const proven = receipt.templates.find((t) => t.template_id === check.template_id).evidence
        .reduce((top, post) => (post.views > top.views ? post : top));
      assert.equal(check.hook_limit, Math.max(80, proven.first_line.length), `${check.template_id} limit is 80 or the proven hook`);
      assert.ok(check.hook_characters <= check.hook_limit, `${check.template_id} hook fits its limit`);
    }
    for (const post of receipt.posts ?? []) {
      const template = receipt.templates.find((t) => t.template_id === post.template_id);
      for (const flag of template.flags ?? []) assert.ok(post.gate_flags?.includes(flag) || post.state !== 'proposed', `${flag} is shown at the gate`);
    }
    for (const slot of receipt.schedule_proposal?.slots ?? []) {
      if (receipt.fallback_used) assert.equal(slot.idempotency_key, undefined, 'a local packet makes no write key');
      else assert.match(slot.idempotency_key, /^viral-posts:[^:@]+:[^:]+:[0-9a-f]{12}$/);
    }
    assertFreshReaders(receipt);
    const account = receipt.account_handle.replace(/^@/, '');
    for (const post of (receipt.posts ?? []).filter((p) => p.state !== 'excluded')) {
      const print = crypto.createHash('sha256')
        .update(JSON.stringify([account, post.parts, post.media, post.scheduled_at])).digest('hex');
      assert.equal(post.fingerprint, print, `${post.template_id} fingerprint uses the account with no @`);
      assert.equal(post.idempotency_key, `viral-posts:${account}:${post.template_id}:${print.slice(0, 12)}`, 'the whole key rebuilds');
      assert.match(post.scheduled_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, 'time is YYYY-MM-DDTHH:mm:ss±hh:mm');
      const withMillis = post.scheduled_at.replace(/(:\d{2})([+-]\d{2}:\d{2})$/, '$1.000$2');
      assert.notEqual(crypto.createHash('sha256').update(JSON.stringify([account, post.parts, post.media, withMillis])).digest('hex'), post.fingerprint,
        'the .000 form of the same time makes a different fingerprint');
      if (post.schedule_call) assert.equal(post.schedule_call.scheduled_at, post.scheduled_at, 'the write sends the same time string');
      if (post.text_source === 'hand_fixed') {
        assert.ok(post.gate_flags?.some((flag) => flag.includes(`saved draft ${post.saved_draft_id} keeps the old wording`)));
      }
      if (post.schedule_call) {
        assert.equal(post.schedule_call.idempotency_key, post.idempotency_key);
        for (const banned of ['platforms', 'auto_plug', 'auto_repost', 'draft_id']) assert.ok(!(banned in post.schedule_call), `no ${banned}`);
        assert.equal(post.schedule_call.account, account, 'the write names the approved account');
        assert.equal(post.schedule_call.content_type, post.parts.length > 1 ? 'long-form' : 'short-form');
        assert.deepEqual(post.schedule_call.posts?.map((part) => part.text) ?? [post.schedule_call.text], post.parts, 'the exact approved text goes by value');
        assert.ok(post.saved_draft_id, 'the draft id stays in the receipt as where the text came from');
      }
    }
    if (!receipt.fallback_used) assert.ok(receipt.global_auto_repost?.read, 'the setting is read in step 1');
    for (const template of receipt.templates.filter((t) => t.status === 'used' || t.status === 'eligible')) {
      const run = longestFixedRun(template.skeleton);
      if (run.length >= 2) {
        assert.deepEqual(template.tired_check_queries, tiredQueries(run.join(' ')), `${template.template_id} searches its longest stretch of fixed words, in both forms when it has an apostrophe or quote mark`);
      } else {
        assert.deepEqual(template.tired_check_queries, [], `${template.template_id} has no stretch search can find`);
        assert.ok(template.flags?.includes('tired_check_incomplete'), `${template.template_id} is flagged tired check incomplete`);
      }
    }
  }
  assert.ok(receipts[0].templates.some((t) => t.status === 'unproven' && t.evidence.filter((post) => post.views >= receipts[0].top_10_line.views).length >= 2),
    'the pending fixture covers a recycled post counted once');
  assert.ok(receipts[0].templates.some((t) => t.evidence.some((post) => post.plug_part_left_out)), 'the pending fixture covers a plug part');
  const numberOnly = receipts[0].templates.find((t) => {
    const hits = t.evidence.filter((post) => post.views >= receipts[0].top_10_line.views);
    return new Set(hits.map((post) => sameText(post.fill))).size >= 2 && new Set(hits.map((post) => sameFill(post.fill))).size < 2;
  });
  assert.equal(numberOnly?.status, 'unproven', 'posts that differ only in a number are one fill');
  const tired = receipts[0].templates.find((t) => t.status === 'tired');
  assert.ok(tired, 'the pending fixture covers a tired template');
  assert.ok(new Set(tired.tired_check.last_three.map((use) => sameText(use.fill))).size < 3, 'its last three uses include a reposted copy');
  for (const receipt of [receipts[0], receipts[2]]) {
    const marks = new Map(receipt.gate_drafts.map((draft) => [draft.draft_id, draft.marked]));
    assert.deepEqual([...marks.keys()].sort(), [...receipt.drafts_saved].sort(), 'every saved draft is named at the gate');
    for (const mark of marks.values()) assert.ok(['proposed', 'excluded', 'not_picked'].includes(mark));
    for (const post of receipt.posts.filter((p) => p.saved_draft_id)) {
      assert.notEqual(marks.get(post.saved_draft_id), 'not_picked', `${post.template_id} draft is marked for what it became`);
    }
  }
  assert.ok(receipts[1].templates.some((t) => t.status === 'shape_unverified'), 'the fallback fixture covers a cut-off paste');
  assert.ok(receipts.some((r) => r.templates.some((t) => (t.also_labels ?? []).length > 0)), 'a fixture covers a template with more than one label');
  assert.ok(receipts[1].templates.some((t) => t.status === 'media_unknown'), 'the fallback fixture covers an unanswered picture question');
  assert.ok(receipts[0].templates.some((t) => t.status === 'unproven'), 'the pending fixture covers a one-hit shape');
  assert.ok(receipts[0].templates.some((t) => t.status === 'used' && t.flags?.includes('tired_check_incomplete')), 'covers a flagged template');

  const pending = receipts[0];
  assert.ok(pending.global_auto_repost.gate_line.startsWith(pending.global_auto_repost.read.enabled ? 'on:' : 'off'));
  const queue = pending.queue_text_check;
  assert.deepEqual(queue.fetched_full_text, queue.cut_off_or_multi_part, 'every cut-off or multi-part queued post is read in full');
  assert.deepEqual(queue.unresolved, []);
  const collided = new Set(queue.collisions.map((hit) => hit.template_id));
  assert.ok(collided.size > 0, 'covers a post that repeats queued text');
  const slotKeys = new Map(pending.schedule_proposal.slots.map((slot) => [slot.template_id, slot.idempotency_key]));
  assert.ok(pending.templates.some((t) => t.status === 'control_failed'), 'the pending fixture covers a failed control with no waiver');
  assert.ok(pending.posts.some((post) => post.state === 'proposed' && pending.templates.find((t) => t.template_id === post.template_id).fresh_reader_waiver),
    'the pending fixture covers a waived template proposed at the gate');
  assert.ok(receipts[1].checks.some((check) => check.fresh_reader.result === 'unavailable'), 'the fallback fixture covers no fresh reader');
  for (const post of pending.posts.filter((p) => p.state !== 'excluded')) {
    if (collided.has(post.template_id)) {
      assert.equal(post.state, 'blocked', `${post.template_id} repeats queued text`);
      assert.ok(!slotKeys.has(post.template_id));
      continue;
    }
    assert.equal(post.state, 'proposed');
    assert.equal(post.idempotency_key, slotKeys.get(post.template_id), 'the gate shows the key the yes binds');
  }
  assert.ok(pending.posts.some((post) => post.text_source === 'hand_fixed'), 'covers a hand-fixed post');

  const declined = receipts[3];
  assert.equal(declined.drafting_yes, false);
  assert.deepEqual(declined.drafts_saved, []);
  assert.ok(!declined.posts);
  for (const tool of ['list_viral_items', 'get_viral_item', 'query_brain', 'generate_content', 'schedule_post']) {
    assert.ok(!declined.tool_path.includes(tool), `no ${tool} without the drafting yes`);
  }
  const afterError = receipts[4];
  assert.equal(afterError.fallback_used, true);
  assert.deepEqual(afterError.tool_path, ['get_connection_defaults'], 'the failed call stays in tool_path');
  assert.match(afterError.tool_outcomes[0].outcome, /^error/);

  const after = receipts[2];
  assert.ok(after.drafting_yes);
  assert.deepEqual(after.fingerprint_of, ['account', 'parts', 'media', 'scheduled_at']);
  const print = (post, at = post.scheduled_at) => crypto.createHash('sha256')
    .update(JSON.stringify([after.account_handle.replace(/^@/, ''), post.parts, post.media, at])).digest('hex');
  const states = new Set(after.posts.map((post) => post.state));
  for (const state of ['scheduled', 'blocked', 'schedule_unverified']) assert.ok(states.has(state), `covers ${state}`);
  assert.ok(after.templates.some((t) => t.status === 'needs_media'), 'covers a media template');
  const waivedScheduled = after.posts.filter((post) => post.state === 'scheduled' && after.templates.find((t) => t.template_id === post.template_id).fresh_reader_waiver);
  assert.ok(waivedScheduled.length > 0, 'the after-yes fixture covers a waived template');
  for (const post of waivedScheduled) {
    assert.equal(post.fresh_reader.result, 'fail, waived');
    for (const part of post.parts) assert.ok(after.approved_text.includes(part), 'a waived post is scheduled only with the batch yes');
  }
  for (const post of after.posts) {
    assert.equal(post.fingerprint, print(post), `${post.template_id} fingerprint binds account, parts, media and time`);
    assert.ok(post.idempotency_key.endsWith(`:${post.fingerprint.slice(0, 12)}`));
    const moved = new Date(Date.parse(post.scheduled_at) + 3600e3).toISOString();
    assert.notEqual(print(post, moved).slice(0, 12), post.fingerprint.slice(0, 12), 'a new time makes a new key');
    const confirmed = post.readback?.status === 'scheduled' && post.readback.account_matches
      && post.readback.text_matches && post.readback.time_matches;
    if (post.state === 'scheduled') {
      assert.deepEqual(post.auto_repost_at_dispatch, after.global_auto_repost.read, 'the setting at dispatch matches the gate');
      assert.ok(post.scheduled_post_id, 'a scheduled post keeps its returned id');
      assert.ok(confirmed, 'scheduled only after a matching readback');
    } else {
      assert.ok(!confirmed, `${post.state} is never reported as scheduled`);
    }
    if (post.state === 'blocked') assert.ok(!post.scheduled_post_id && post.blocked_reason);
    if (!confirmed) assert.notEqual(post.state, 'scheduled');
  }
  const dispatchChecks = new Map(after.dispatch_queue_checks.map((check) => [check.template_id, check]));
  for (const post of after.posts) {
    const check = dispatchChecks.get(post.template_id);
    assert.ok(check, `${post.template_id} rechecks queued text at dispatch`);
    assert.deepEqual(check.fetched_full_text, check.cut_off_or_multi_part, 'every cut-off or multi-part queued post is read again at dispatch');
    assert.equal(check.reused_earlier_text, false);
    assert.deepEqual(check.unresolved, []);
    if (post.schedule_call) assert.deepEqual(check.collisions, [], `${post.template_id} was written only after a clean fresh check`);
  }
  const edited = after.posts.find((post) => dispatchChecks.get(post.template_id).collisions
    .some((hit) => ['id', 'preview', 'part_count'].every((field) => hit.unchanged_since_gate?.includes(field))));
  assert.equal(edited?.state, 'blocked', 'a later-part edit with the same id, preview and part count still blocks the post');
  assert.ok(!edited.schedule_call);
  assert.ok(!JSON.stringify(after).includes('published'), 'the receipt never says published');
});

test('Viral Posts fresh-reader results come from the reader\'s own DELIVERS word', () => {
  const pending = readJson('validation/mock-fixtures/viral-posts.awaiting-approval.receipt.json');
  const fallback = readJson('validation/mock-fixtures/viral-posts.fallback.receipt.json');
  const mutate = (receipt, change) => { const copy = structuredClone(receipt); change(copy); return copy; };
  const passing = (r) => r.checks.find((check) => check.fresh_reader.result === 'pass').fresh_reader;
  const waivedRow = (r) => r.checks.find((check) => check.fresh_reader.result === 'fail, waived');
  const waivedTemplate = (r) => r.templates.find((t) => t.template_id === waivedRow(r).template_id);
  const failedControl = (r) => r.templates.find((t) => t.status === 'control_failed');
  const say = (record, word) => { record.answer = record.answer.replace(/DELIVERS: (clear yes|borderline|no)/, `DELIVERS: ${word}`); };
  assert.doesNotThrow(() => assertFreshReaders(pending));
  assert.ok(waivedRow(pending).fresh_reader.verdict !== 'clear yes' && waivedTemplate(pending).fresh_reader_waiver,
    'the pending fixture has a waived template whose reader did not say clear yes');
  const broken = {
    'answer says borderline, verdict and result left at clear yes and pass': (r) => say(passing(r), 'borderline'),
    'verdict says borderline, answer and result left': (r) => { passing(r).verdict = 'borderline'; },
    'answer and verdict say borderline, result left at pass': (r) => { say(passing(r), 'borderline'); passing(r).verdict = 'borderline'; },
    'answer has no DELIVERS line': (r) => { const f = passing(r); f.answer = f.answer.replace('DELIVERS: clear yes', 'clear yes'); },
    'answer has two DELIVERS lines': (r) => { passing(r).answer += ' / DELIVERS: no'; },
    'answer has no KIND line': (r) => { const f = passing(r); f.answer = f.answer.replace(/KIND: [^/\n]+\/ /, ''); },
    'waived post whose reader said clear yes': (r) => { const f = waivedRow(r).fresh_reader; say(f, 'clear yes'); f.verdict = 'clear yes'; },
    'waived post with the waiver removed': (r) => { delete waivedTemplate(r).fresh_reader_waiver; },
    'waiver naming another template': (r) => { waivedTemplate(r).fresh_reader_waiver.template_id = 'some-other-template'; },
    'failed control recorded as pass': (r) => { failedControl(r).fresh_reader_control.result = 'pass'; },
    'control verdict says clear yes, answer left': (r) => { failedControl(r).fresh_reader_control.verdict = 'clear yes'; },
    'failed control used with no waiver': (r) => { failedControl(r).status = 'used'; },
    'clear-yes post on a waived template still labelled fail, waived': (r) => {
      const f = waivedRow(r).fresh_reader; say(f, 'clear yes'); f.verdict = 'clear yes'; f.result = 'pass';
    },
  };
  for (const [name, change] of Object.entries(broken)) {
    assert.throws(() => assertFreshReaders(mutate(pending, change)), assert.AssertionError, name);
  }
  assert.throws(() => assertFreshReaders(mutate(fallback, (r) => { r.checks[0].fresh_reader.result = 'pass'; })), assert.AssertionError,
    'a self-read recorded as pass');
  // a self-read is unavailable only for a clear yes; a borderline or no is a fail and its post is never proposed
  const selfSays = (word, result, states = []) => mutate(fallback, (r) => {
    const f = r.checks[0].fresh_reader; say(f, word); f.verdict = word; f.result = result;
    if (states.length) r.posts = states.map((state) => ({ template_id: r.checks[0].template_id, state, parts: ['redacted local post'] }));
  });
  assert.equal(fallback.checks[0].fresh_reader.reader.startsWith('self-read'), true, 'the fallback fixture check is a self-read');
  for (const word of ['borderline', 'no']) {
    assert.throws(() => assertFreshReaders(selfSays(word, 'unavailable')), assert.AssertionError, `a self-read of ${word} labelled unavailable`);
    assert.throws(() => assertFreshReaders(selfSays(word, 'fail', ['proposed'])), assert.AssertionError, `a self-read of ${word} with its post proposed`);
    assert.doesNotThrow(() => assertFreshReaders(selfSays(word, 'fail')), `a self-read of ${word} is a fail when no post is made`);
    assert.doesNotThrow(() => assertFreshReaders(selfSays(word, 'fail', ['excluded'])), `a self-read of ${word} is a fail with its post excluded`);
  }
  assert.doesNotThrow(() => assertFreshReaders(selfSays('clear yes', 'unavailable')), 'a self-read clear yes stays unavailable');
  const saidNo = mutate(pending, (r) => { const f = waivedRow(r).fresh_reader; say(f, 'no'); f.verdict = 'no'; });
  assert.doesNotThrow(() => assertFreshReaders(saidNo), 'a reader who said no on a waived template is fail, waived');
  const passedAnyway = mutate(pending, (r) => {
    const row = waivedRow(r); const f = row.fresh_reader; say(f, 'clear yes'); f.verdict = 'clear yes'; f.result = 'pass';
    for (const post of r.posts.filter((p) => p.template_id === row.template_id)) post.gate_flags = post.gate_flags.filter((g) => !g.startsWith('fresh reader: fail'));
  });
  assert.doesNotThrow(() => assertFreshReaders(passedAnyway), 'a clear yes on a waived template is a plain pass');
});

// A curly apostrophe and a straight one are the same mark when comparing words.
const wordsOf = (text) => text.toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}\p{N}']+/gu) ?? [];
const fixedWords = (skeleton) => wordsOf(skeleton.split(/\[[^\]]*\]/).join(' '));
const words = (line) => wordsOf(line);
// A fixed word sits in the same place in every evidence post: the same word count from the start of the line, or from its end (SKILL.md step 2).
const anchoredShared = (lines) => {
  const all = lines.map(words); const [first] = all;
  return first.filter((word, i) => all.every((w) => w[i] === word) || all.every((w) => w[w.length - first.length + i] === word));
};
const inOrder = (needles, hay) => { let k = 0; for (const w of hay) if (w === needles[k]) k += 1; return k === needles.length; };
// The hook limit is 80, or the proven hook's length (the first line of the most-viewed evidence post) when that is longer (SKILL.md rule 2).
const hookLimit = (template) => Math.max(80, template.evidence.reduce((top, post) => (post.views > top.views ? post : top)).first_line.length);
const isRedacted = (line) => /^redacted/.test(line ?? '');
// A fact fills a one-span hook with its words in order; letter case and the closing mark follow the template (SKILL.md step 3).
const closingMark = (line) => (line.match(/[.!?:]$/) ?? [''])[0];
const fillSpan = (hook, fact) => {
  const lower = hook.replace(/\[[^\]]*\]/g, '') === hook.replace(/\[[^\]]*\]/g, '').toLowerCase();
  let body = fact.trim().replace(/[.!?:;,…]+$/, '');
  if (lower) body = body.split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
  return hook.slice(0, hook.indexOf('[')) + body + hook.slice(hook.lastIndexOf(']') + 1);
};
// Claim words keep a hyphen ("5-minute" is one word) and drop the template's fixed words and the skill's small words (SKILL.md step 3).
const claimWords = (fact, skeletonHook) => [...new Set((fact.toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}\p{N}'-]+/gu) ?? [])
  .filter((word) => !SMALL_WORDS.includes(word) && !fixedWords(skeletonHook).includes(word)))];
// A version keeps its fact word for word when its first line holds the fact's words in order, letter case and the closing mark aside.
const plain = (text) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
const keepsFact = (hook, fact) => plain(hook).includes(plain(fact));
const followsTemplate = (skeletonHook, filled) => {
  const mark = closingMark(skeletonHook);
  const markOk = !mark || (filled.endsWith(mark) && !/[.!?:;,…]$/.test(filled.slice(0, -1)));
  const lower = skeletonHook.replace(/\[[^\]]*\]/g, '') === skeletonHook.replace(/\[[^\]]*\]/g, '').toLowerCase();
  const caseOk = !lower || filled.split(/\s+/).every((w) => w === w.toLowerCase() || (w.length > 1 && w.replace(/[^\p{L}]/gu, '') === w.replace(/[^\p{L}]/gu, '').toUpperCase()));
  return markOk && caseOk;
};

test('Viral Posts checks the hook fits before drafting and keeps shared words fixed', () => {
  // the rule on a live-shaped pair: "your" is in both fills but moves, so it stays inside a placeholder
  const moving = ['the longer i build the more i see rest is the secret weapon of your best days.', 'the longer i build the more i see silence is your answer.'];
  assert.deepEqual(anchoredShared(moving), words('the longer i build the more i see is'), 'only words in the same place are fixed');
  assert.deepEqual(anchoredShared(['nobody warns you that success feels quiet.', 'nobody warns you, that growth looks boring up close.']), words('nobody warns you that'), 'punctuation does not move a word');
  assert.deepEqual(anchoredShared(['i walked daily for 90 days. here’s what changed:', "i quit sugar for a year. here's what happened:"]), words("i for here's what"), 'a word between placeholders is fixed when it sits at the same count');
  // the limit is derived from the evidence, at the 80/81 boundary
  assert.deepEqual(claimWords('Weekends are too short for 5-minute habits', 'nobody warns you that [truth].'), ['weekends', 'short', '5-minute', 'habits']);
  assert.deepEqual(claimWords("they don't skip the boring reps", "i [did X] for [time]. here's what [result]:"), ['skip', 'boring', 'reps'], 'pronouns and common verbs are small words');
  assert.deepEqual(claimWords('comfort is a slow leak.', '[thing] is [what it really is].'), ['comfort', 'slow', 'leak']);
  assert.ok(keepsFact('nobody warns you that AI drafts are the new homework.', 'AI drafts are the new homework.'));
  assert.ok(keepsFact('Comfort Is A Slow Leak!', 'comfort is a slow leak.'), 'letter case and closing mark aside');
  assert.ok(!keepsFact('nobody warns you that drafts are the new homework.', 'AI drafts are the new homework.'), 'a dropped word is not word for word');
  assert.equal(hookLimit({ evidence: [{ first_line: 'x'.repeat(80), views: 2 }, { first_line: 'short', views: 1 }] }), 80);
  assert.equal(hookLimit({ evidence: [{ first_line: 'x'.repeat(81), views: 2 }, { first_line: 'short', views: 1 }] }), 81, 'a proven 81-character hook lifts the limit to 81');
  assert.equal(hookLimit({ evidence: [{ first_line: 'x'.repeat(81), views: 1 }, { first_line: 'short', views: 2 }] }), 80, 'only the most-viewed post sets it');
  // the fact keeps its words; case and the closing mark follow the template, and the hook is counted as posted
  const stem = 'the longer i build the more i see [thing] is [what it is].';
  assert.equal(fillSpan(stem, 'AI is a draft partner, not a ghostwriter'), 'the longer i build the more i see AI is a draft partner, not a ghostwriter.', 'a capitals word keeps its capitals; the period is added');
  assert.equal(fillSpan(stem, 'Sleep is underrated.'), 'the longer i build the more i see sleep is underrated.', 'lowercase template, one period, never doubled');
  assert.equal(fillSpan(stem, 'Rest is a weapon!'), 'the longer i build the more i see rest is a weapon.', "the skeleton's mark replaces the fact's");
  const at82 = fillSpan(stem, 'Consistency is the quiet secret of a great year');
  assert.equal(at82.length, 82, 'counted as posted, with its closing period');
  assert.ok(at82.length > hookLimit({ evidence: [{ first_line: 'x'.repeat(81), views: 2 }] }), 'a hook that is 81 only without its period does not fit an 81 limit');
  assert.ok(followsTemplate(stem, at82) && !followsTemplate(stem, at82.slice(0, -1)) && !followsTemplate(stem, `${at82}.`), 'the mark is there once');
  assert.ok(!followsTemplate(stem, 'the longer i build the more i see Life is too short.'), 'a lowercase template keeps the fact lowercase');

  const receipts = ['awaiting-approval', 'after-yes', 'fallback', 'fallback-after-error'].map((name) => [name, readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`)]);
  let noFit = 0; let checkedSkeletons = 0; let movers = 0; let repeats = 0; let narrowed = 0; let incomplete = 0; let noAnswer = 0; let answered = 0;
  for (const [name, receipt] of receipts) {
    if (!receipt.fallback_used) assert.equal(receipt.drafting_yes, true, name);
    const firstGenerate = receipt.tool_path.indexOf('generate_content');
    const beforeDrafting = firstGenerate >= 0 ? firstGenerate : receipt.tool_path.length;
    for (const template of receipt.templates) {
      const where = `${name} ${template.template_id}`;
      for (const fit of template.hook_fit ?? []) {
        assert.equal(fit.filled_hook_chars, fit.filled_hook.length, `${where} counts the filled hook "${fit.filled_hook}"`);
        assert.ok(followsTemplate(template.skeleton.split('\n')[0], fit.filled_hook), `${where} "${fit.filled_hook}" takes the template's case and closing mark once`);
        // (b) every fact that fits is checked against the creator's own posts before drafting; a match is skipped
        if (fit.filled_hook_chars <= fit.limit) {
          const check = fit.repeat_check;
          assert.ok(Array.isArray(check?.searches) && check.searches.length > 0 && Array.isArray(check.matches), `${where} "${fit.fact}" has a repeat check`);
          const claim = claimWords(fit.fact, template.skeleton.split('\n')[0]);
          const searched = check.searches.map((search) => search.word.toLowerCase());
          assert.equal(new Set(searched).size, searched.length, `${where} searches each word once`);
          for (const search of check.searches) {
            assert.ok(claim.includes(search.word.toLowerCase()), `${where} "${search.word}" is a claim word of "${fit.fact}" (${claim.join(', ')})`);
            assert.ok([search.total, search.returned, search.read].every(Number.isInteger) && search.read <= search.returned && search.returned <= search.total,
              `${where} "${search.word}" records its total, the posts returned and the posts read`);
            const foundIt = check.matches.length > 0 && search === check.searches.at(-1); // the word that found the match may stop reading there
            if (search.read < search.returned && !foundIt) {
              narrowed += 1;
              assert.ok(search.total > 200 && typeof search.narrowed_by === 'string' && search.narrowed_by, `${where} only a word with more than 200 matches is narrowed, and the rule is recorded`);
              assert.ok(check.searches.some((other) => other !== search && other.read === other.total), `${where} a narrowed word needs another claim word read in full`);
            }
          }
          assert.equal(check.in === 'pasted posts', Boolean(receipt.fallback_used), `${where} only the local fallback checks pasted posts instead of search_posts`);
          assert.equal(typeof check.creator_search === 'string' && check.creator_search.length > 0, Boolean(receipt.fallback_used), `${where} the fallback records the creator's own search, or no answer`);
          if (check.searches.some((search) => search.returned < search.total)) {
            incomplete += 1;
            assert.match(fit.skipped ?? '', /^repeat check incomplete/, `${where} "${fit.fact}" could not get every match, so it is left out`);
          }
          if (check.matches.length) {
            repeats += 1;
            assert.match(fit.skipped ?? '', /^repeat/, `${where} "${fit.fact}" repeats one of the creator's posts and is skipped`);
            for (const match of check.matches) assert.equal(match.found_by, searched.at(-1), `${where} stops at the word that found the match`);
          } else if (!fit.skipped) {
            assert.deepEqual([...searched].sort(), [...claim].sort(), `${where} searches every claim word of "${fit.fact}" before calling it new`);
            assert.ok(check.closest === 'none' || (check.closest?.date && check.closest?.line && check.closest?.why_not), `${where} names the closest post, or none`);
            assert.doesNotMatch(String(check.closest?.why_not ?? ''), /borderline|your call|confirm/i, `${where} decides the closest post itself`);
          }
        }
        assert.equal(fit.limit, hookLimit(template), `${where} limit is 80 or its proven hook`);
        assert.ok(inOrder(fixedWords(template.skeleton.split('\n')[0]), words(fit.filled_hook)), `${where} filled hook keeps the skeleton's fixed words`);
        assert.ok(Number.isInteger(fit.after_tool_calls) && fit.after_tool_calls <= beforeDrafting, `${where} hook fit counted before any generate_content`);
        if (!receipt.fallback_used) assert.ok(receipt.tool_path.slice(0, fit.after_tool_calls).includes('query_brain'), `${where} hook fit counted after query_brain`);
      }
      const fitting = (template.hook_fit ?? []).filter((f) => f.filled_hook_chars <= f.limit && !f.skipped && !f.repeat_check?.matches.length).map((f) => f.fact);
      // the fallback's proposed post says when its repeat check saw only the pasted posts (the creator gave no search of their own)
      if (receipt.fallback_used && (receipt.schedule_proposal?.slots ?? []).some((slot) => slot.template_id === template.template_id)) {
        const unsearched = (template.hook_fit ?? []).some((f) => fitting.includes(f.fact) && f.repeat_check?.creator_search === 'no answer');
        const post = (receipt.checks ?? []).find((c) => c.template_id === template.template_id);
        assert.equal(post?.repeat_gate_line, unsearched ? 'repeat check: pasted posts only' : undefined, `${where} the proposed post shows "repeat check: pasted posts only" only when the creator gave no search`);
        if (unsearched) noAnswer += 1; else answered += 1;
      }
      if (template.status === 'used') {
        assert.ok(fitting.length > 0, `${where} drafts only with a fact that fits`);
        for (const draft of (receipt.gate_drafts ?? []).filter((d) => d.template_id === template.template_id)) {
          assert.ok(fitting.includes(draft.fact), `${where} ${draft.draft_id} names a fact that fits`);
        }
      }
      if (template.status === 'no_fitting_fact') {
        noFit += 1;
        assert.ok(template.hook_fit.length > 0 && fitting.length === 0, `${where} has no fact that fits`);
        assert.ok(!(receipt.gate_drafts ?? []).some((d) => d.template_id === template.template_id), `${where} made no generate_content call`);
        assert.ok(!(receipt.posts ?? []).some((p) => p.template_id === template.template_id), `${where} has no post`);
      }
      const lines = (template.evidence ?? []).filter((e) => e.source_complete).map((e) => e.first_line);
      if (['used', 'no_fitting_fact'].includes(template.status)) {
        assert.ok(lines.length >= 2 && !lines.some(isRedacted), `${where} shows real evidence lines the skeleton can be checked against`);
      }
      if (lines.length >= 2 && !lines.some(isRedacted)) {
        checkedSkeletons += 1;
        const fixed = anchoredShared(lines);
        assert.deepEqual(fixedWords(template.skeleton.split('\n')[0]), fixed, `${where} skeleton fixes exactly the words in the same place in every evidence post (${fixed.join(' ')})`);
        if (words(lines[0]).some((w) => !fixed.includes(w) && lines.every((l) => words(l).includes(w)))) movers += 1;
      }
    }
  }
  assert.ok(noFit >= 1, 'a fixture covers a template with no fitting fact');
  assert.ok(repeats >= 1, "a fixture covers a fact that repeats one of the creator's own posts");
  assert.ok(narrowed >= 1, 'a fixture covers a word with more than 200 matches that is narrowed');
  assert.ok(incomplete >= 1, 'a fixture covers a fact whose matches could not all be fetched');
  assert.ok(noAnswer >= 1 && answered >= 1, 'the fallback fixtures cover a creator who searched and one who gave no answer');
  // (g) every saved draft records whether its text kept the fact; a changed fact never reaches the gate as a live post
  for (const [name, receipt] of receipts.filter(([, r]) => !r.fallback_used)) {
    for (const draft of receipt.gate_drafts ?? []) {
      assert.ok(['word for word', 'shortened', 'changed'].includes(draft.fact_kept), `${name} ${draft.draft_id} records fact_kept`);
      assert.ok(typeof draft.hook === 'string' && draft.hook, `${name} ${draft.draft_id} records the first line fact_kept was judged on`);
      assert.equal(draft.fact_kept === 'word for word', keepsFact(draft.hook, draft.fact), `${name} ${draft.draft_id} says "${draft.fact_kept}" and its first line is "${draft.hook}"`);
    }
    for (const post of (receipt.posts ?? []).filter((p) => p.state !== 'excluded' && p.saved_draft_id)) {
      const draft = receipt.gate_drafts.find((d) => d.draft_id === post.saved_draft_id);
      assert.notEqual(draft.fact_kept, 'changed', `${name} ${post.template_id} is not built on a draft that changed its fact`);
    }
  }
  assert.ok(movers >= 1, 'a fixture covers a shared word that moves inside the fills');
  assert.ok(checkedSkeletons >= 6, 'the fixtures carry evidence lines the skeletons can be checked against');
  for (const [name, receipt] of receipts.filter(([, r]) => !r.fallback_used)) {
    const keys = (receipt.gate_drafts ?? []).map((d) => d.idempotency_key);
    assert.ok(keys.length > 0 && keys.every(Boolean), `${name} keeps a generate_content key for every saved draft`);
    assert.equal(new Set(keys).size, keys.length, `${name} uses a different key for each version`);
  }
  let selfRead = 0;
  for (const name of ['fallback', 'fallback-after-error']) {
    for (const template of readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`).templates.filter((t) => /self-read/.test(t.fresh_reader_control?.reader ?? ''))) {
      selfRead += 1;
      const control = template.fresh_reader_control;
      assert.equal(control.result, 'unavailable', `${name} ${template.template_id} self-read control is unavailable`);
      assert.match(control.answer ?? '', /DELIVERS:/, `${name} ${template.template_id} keeps the self-read answer`);
      assert.equal(control.verdict, control.answer.match(/DELIVERS:\s*(clear yes|borderline|no)/)[1], `${name} ${template.template_id} verdict is the self-read DELIVERS word`);
    }
  }
  assert.ok(selfRead >= 1, 'a fixture covers a self-read control');
});

test('Viral Posts keeps apostrophes and quote marks in the tired search, as written, all straight and all curly', () => {
  for (const [skeleton, straight, curly] of [
    ['[name] don\'t say "no" to [thing].', 'don\'t say "no" to', 'don’t say “no” to'],
    ['[name] don’t say “no” to [thing].', 'don’t say “no” to', 'don\'t say "no" to'],
  ]) {
    const query = longestFixedRun(skeleton).join(' ');
    assert.equal(query, straight, 'the stretch keeps its own marks');
    assert.deepEqual(tiredQueries(query), [straight, curly], 'and is searched in the other form too');
  }
  for (const mixed of ['don’t say "no" to', 'don\'t say “no” to']) {
    assert.deepEqual(tiredQueries(mixed), [mixed, 'don\'t say "no" to', 'don’t say “no” to'], 'mixed marks are searched as written, all straight and all curly');
  }
  assert.deepEqual(tiredQueries('it took me years'), ['it took me years'], 'a stretch with no mark is searched once');
  assert.deepEqual(fixedWords('[name] don’t stop [thing]'), words("don't stop"), 'the shared-word check reads both apostrophes as one word');
});

test('Viral Posts fixtures stay inside the drafting limits and record every call', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Pick up to three templates/);
  assert.match(skill, /at most 2 versions per template, 6 calls in all/);
  const count = (receipt, tool) => receipt.tool_path.filter((name) => name === tool).length;
  for (const name of ['awaiting-approval', 'fallback', 'after-yes', 'drafting-declined', 'fallback-after-error']) {
    const receipt = readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`);
    const used = new Set(receipt.templates.filter((t) => t.status === 'used').map((t) => t.template_id));
    assert.ok(used.size <= 3, `${name} picks at most three templates`);
    const drafts = receipt.gate_drafts ?? [];
    assert.ok(drafts.length <= 6, `${name} makes at most 6 versions`);
    for (const id of new Set(drafts.map((d) => d.template_id))) {
      assert.ok(used.has(id), `${name}: ${id} drafts only as a picked template`);
      assert.ok(drafts.filter((d) => d.template_id === id).length <= 2, `${name}: ${id} has at most 2 versions`);
    }
    assert.deepEqual(drafts.map((d) => d.draft_id), receipt.drafts_saved ?? [], `${name} shows every saved draft at the gate, in order`);
    assert.equal(count(receipt, 'generate_content'), drafts.length, `${name} records one generate_content call per saved draft (no retries here)`);
    if (receipt.fallback_used) {
      assert.ok(receipt.tool_path.every((tool) => tool === 'get_connection_defaults'), `${name} calls no Threadify tool after the failed connect`);
    } else {
      const evidence = receipt.templates.reduce((n, t) => n + (t.evidence ?? []).filter((e) => e.source_complete).length, 0);
      assert.ok(count(receipt, 'get_post_thread') >= evidence, `${name} reads every one of its ${evidence} evidence posts in full`);
      const counted = receipt.templates.filter((t) => (t.hook_fit ?? []).length > 0).length;
      assert.ok(count(receipt, 'query_brain') >= counted, `${name} calls query_brain for each of the ${counted} templates it counts a hook for`);
      const queries = receipt.templates.reduce((n, t) => n + (t.tired_check_queries ?? []).length, 0);
      const repeatChecks = receipt.templates.reduce((n, t) => n + (t.hook_fit ?? []).reduce((m, f) => m + (f.repeat_check?.searches ?? []).length, 0), 0);
      const firstGenerate = receipt.tool_path.indexOf('generate_content');
      const beforeDrafting = receipt.tool_path.slice(0, firstGenerate >= 0 ? firstGenerate : undefined);
      assert.ok(beforeDrafting.filter((tool) => tool === 'search_posts').length >= queries + repeatChecks,
        `${name} records a search_posts call for every tired-check query (${queries}) and repeat-check word (${repeatChecks}) before any generate_content`);
    }
    if (receipt.queue_text_check) {
      assert.ok(count(receipt, 'get_schedule_status') >= receipt.queue_text_check.fetched_full_text.length, `${name} records every full-text fetch`);
    }
    if (receipt.dispatch_queue_checks) {
      assert.ok(count(receipt, 'get_connection_defaults') >= receipt.posts.length, `${name} rechecks the connection for every post`);
      const fetched = receipt.dispatch_queue_checks.reduce((n, c) => n + c.fetched_full_text.length, 0);
      const atGate = receipt.queue_text_check?.fetched_full_text.length ?? 0;
      assert.ok(count(receipt, 'get_schedule_status') >= fetched + atGate, `${name} records every full-text fetch at the gate and at dispatch`);
    }
  }
});

test('Viral Posts lists the calendar at least 2 hours past every slot, at the gate and at dispatch', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Every proposed slot must be at least 2 hours inside the window you listed \(2 hours after its start and 2 hours before its end\)/);
  assert.match(skill, /again for a window that starts at least 2 hours before this post's slot and ends at least 2 hours after it/);
  const at = (time) => Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(time) ? time : `${time.replace(' ', 'T')}:00Z`);
  const inside = (time, window) => at(time) - at(window.start) >= 2 * 3600e3 && at(window.end) - at(time) >= 2 * 3600e3;
  const edge = { start: '2026-06-02 00:00', end: '2026-06-03 00:00' };
  assert.ok(!inside('2026-06-02 23:30', edge), 'a slot 30 minutes before the window ends is refused: a post at 00:30 would be unseen');
  assert.ok(!inside('2026-06-02 01:00', edge), 'a slot 1 hour after the window starts is refused');
  assert.ok(inside('2026-06-02 22:00', edge) && inside('2026-06-02 02:00', edge), 'exactly 2 hours inside is enough');

  for (const name of ['awaiting-approval', 'after-yes']) {
    const proposal = readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`).schedule_proposal;
    const window = proposal.calendar_window;
    assert.ok(window?.start && window?.end, `${name} gate records the window it listed`);
    assert.equal(proposal.calendar_listed, proposal.calendar_total_in_window, `${name} gate lists the whole window`);
    for (const slot of proposal.slots) assert.ok(inside(slot.local_time, window), `${name} ${slot.template_id} sits at least 2 hours inside the listed window`);
  }
  for (const name of ['fallback', 'fallback-after-error']) {
    const proposal = readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`).schedule_proposal;
    assert.equal(proposal.calendar_listed, null, `${name} listed no calendar`);
    for (const slot of proposal.slots) assert.match(slot.label, /not checked against the live calendar/);
  }

  const after = readJson('validation/mock-fixtures/viral-posts.after-yes.receipt.json');
  for (const post of after.posts) {
    const check = after.dispatch_queue_checks.find((c) => c.template_id === post.template_id);
    assert.equal(check.calendar_listed, check.calendar_total_in_window, `${post.template_id} relists the whole window at dispatch`);
    assert.ok(check.calendar_window && inside(post.scheduled_at, check.calendar_window), `${post.template_id} relists at least 2 hours either side of its slot`);
  }
});
