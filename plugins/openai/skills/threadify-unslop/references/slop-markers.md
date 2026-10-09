# Slop markers

Slop is not "written with AI". Slop is copy that refuses to commit. It sounds safe, polished and interchangeable, so nobody stops for it. Threadify Unslop scores every post on four families of markers and weights hedging highest, because hedging is the marker that kills a take before it lands.

`scripts/hedge_gate.mjs` enforces this file. It quotes every phrase it flags, exactly as written. The agent reports the phrase and never rewrites it.

## 1. Hedging (weight 3, zero tolerance)

**Rule: zero hedges. Not fewer hedges. Zero.** Every post Threadify writes for this workflow states its claim and stands behind it. One hedge fails the gate.

This rule overrides every other anti-slop source the owner uses:

- Sources that cut only "excessive" hedging leave one hedge standing. Unslop cuts all of them.
- Sources that rewrite a stack of hedges into a single `may` still ship a hedge. Unslop rejects `may` itself.
- Sources that recommend uncertainty markers (`I'm 60% sure`, `I think I read`, `I'm probably wrong but`) as proof of a human writer are overruled here. A human who believes the take says the take.

**Truth rule.** A claim the owner's data or lived experience does not back gets cut, not softened. A hedge is never the fix for a weak claim. Delete the claim, or keep it at full strength because it is true. The agent never edits words, so an unbacked claim sends the post back to Threadify with the reason `cut unbacked claim: <phrase>`.

**A scope label is a fact, not a hedge.** `on my account, raw posts got 3x the views` names the evidence. It passes. `this might work for some people` names nothing. It fails.

### Lexical hedges

Each of these fails the gate, matched on whole words, any casing:

- Modal softeners: `might`, `may`, `could`, `can be`, `may or may not`, `could potentially`.
- Probability words: `perhaps`, `maybe`, `possibly`, `probably`, `likely`, `unlikely`, `potentially`, `presumably`, `supposedly`, `seemingly`, `hopefully`, `ideally`, `arguably`, `conceivably`.
- Opinion shields: `i think`, `i believe`, `i feel like`, `i feel that`, `in my opinion`, `in my humble opinion`, `imo`, `imho`, `just my opinion`, `just my two cents`, `my two cents`, `i guess`, `i suppose`, `my guess is`, `if i had to guess`, `i'd say`, `i would say`, `i'd argue`, `it could be argued`, `one might say`, `i'm not sure`, `not sure if`, `i'm no expert`, `i'm not an expert`, `could be wrong`, `i might be wrong`, `i'm probably wrong`, `correct me if i'm wrong`, `don't quote me`, `but what do i know`, `who knows`, `pretty sure`.
- Degree softeners: `kind of`, `kinda`, `sort of`, `sorta`, `somewhat`, `a bit`, `a little bit`, `fairly`, `pretty much`, `relatively`, `more or less`, `to some extent`, `to an extent`, `in some ways`, `in a way`, `for the most part`, `not necessarily`, `not always`.
- Appearance and tendency: `seems`, `seem to`, `appears to`, `appears that`, `it appears`, `tends to`, `tend to`, `generally`, `in general`, `typically`, `in most cases`, `it's possible that`.
- Scope dodges: `for some people`, `for some of you`, `not for everyone`, `it depends`, `results may vary`, `your mileage may vary`, `ymmv`, `every account is different`, `everyone is different`, `what works for me`, `do what works for you`, `whatever works for you`.
- Filler shields: `to be fair`, `just a thought`, `food for thought`, `for what it's worth`, `fwiw`, `just saying`, `grain of salt`, `hard to say`, `remains to be seen`, `time will tell`.
- Advice softeners: `try` (as advice), `consider`, `you may want to`, `you might want to`, `you could try`, `might be worth`, `worth considering`, `worth a try`, `give it a try`, `might help`, `could help`, `may help`.

### Structural hedges

Shapes, not single words. Each fails the gate:

- **Both-sides balancing.** The post takes a side, then hands half of it back: `on the other hand`, `that said`, `having said that`, `both have their place`, `there's no right answer`, `pros and cons`, `somewhere in the middle`. Pick the side. Stay there.
- **A closing question that dodges a stance.** The last line asks the reader to decide what the post refused to decide: `thoughts?`, `agree?`, `what do you think?`, `am i wrong?`, `is it just me?`, `..., right?`, `let me know in the comments`. End on the claim.
- **Disclaimers.** `not financial advice`, `no guarantees`, `take this with a grain of salt`, `based on available information`, `while specific details are limited`, `should be treated as ... rather than`. Each one is a hedge wearing a tie.
- **Trailing qualifiers.** A strong sentence with a soft tail: `..., at least for me.`, `..., for now.`, `..., or something.`, `..., i guess.`, `..., if that makes sense.` Cut the tail and the sentence stands.
- **Softened CTAs.** The ask apologises for asking: `if you want`, `if you're interested`, `feel free to`, `no pressure`, `if this resonates`, `hope this helps`. Say what to do and where.
- **`and that's okay`.** Permission slips (`and that's okay`, `and that's fine`, `nothing wrong with`, `no shame in`) take the heat out of a take. Unslop keeps the heat.

### Words that look like hedges and are not

The gate passes these, and the tests prove it:

- `May` the month: `in May`, `May 3rd`, `may 2026`, `last may`, `May was my best month`.
- `can` as real ability: `you can schedule a week of posts in 15 minutes`. Only `can be` fails.
- A hedge word inside a quoted title or a proper noun: `"You Might Be Wrong"`, `Might and Magic`. Quoted text, links, @handles and #hashtags are never scanned. A line written in Title Case gets no proper-noun pass.
- `try` as a noun or as narration: `on the first try`, `i try to reply to every comment`, `don't try to go viral`.
- `kind of` and `sort of` as a noun phrase: `this kind of post`, `what sort of creator`.
- `consider` as a claim: `i consider that a win`.
- `in a way` as manner: `write it in a way your mom gets`. Only `in a way,` as a softener fails.
- `i feel` with a real feeling: `i feel sick posting corporate copy`. Only `i feel like` and `i feel that` fail.

## 2. Corporate and LinkedIn voice (weight 1)

Copy that sounds like a press release or a LinkedIn humblebrag. Threads readers scroll past it in under a second.

- Announcement cringe: `excited to announce`, `thrilled to share`, `proud to announce`, `humbled`, `honored to`, `grateful for the opportunity`.
- Office jargon: `leverage`, `synergy`, `stakeholders`, `deliverables`, `circle back`, `touch base`, `move the needle`, `low-hanging fruit`, `bandwidth`, `drill down`.
- Brochure adjectives: `game changer`, `best-in-class`, `cutting-edge`, `innovative`, `seamless`, `robust`, `scalable`, `transformative`, `revolutionary`, `holistic`, `next level`, `unlock your potential`, `empower`.
- LinkedIn bait: `let that sink in`, `read that again`, `this is your sign`, `here's what i learned`, `lessons learned`, `key takeaways`, `repost if`, `follow me for more`, `my journey`.

Write what happened, with the number, in the words you would use out loud.

## 3. AI tells (weight 1)

Patterns that mark text as default model output. The Wikipedia guide below documents them at scale. Unslop flags the ones that show up in short social posts.

- Vocabulary: `delve`, `tapestry`, `testament`, `pivotal`, `realm`, `beacon`, `multifaceted`, `meticulous`, `intricate`, `paramount`, `elevate`, `embark`, `supercharge`, `harness`, `ever-evolving`, `crucial`, `vibrant`, `foster`, `showcase`, `underscore`, `unleash`.
- Throat-clearing and fake reveals: `here's the thing`, `the truth is`, `the reality is`, `let me be clear`, `i'll be honest`, `what if i told you`, `plot twist`, `here's what nobody tells you`, `what most people get wrong`, `the uncomfortable truth`.
- Filler frames: `it's important to note`, `worth noting`, `at the end of the day`, `at its core`, `when it comes to`, `in today's world`, `let's dive in`, `deep dive`, `without further ado`, `in conclusion`, `to summarize`.
- Fancy stand-ins for "is": `serves as`, `stands as`, `plays a vital role`.
- Contrast templates: `not only ... but also`, `it's not about X, it's about Y`, `not just X, but Y`.
- Stiff connectors: `furthermore`, `moreover`, `additionally`.
- Chatbot leftovers: `great question`, `i hope this helps`, `here's a breakdown`.

## 4. Over-formatting (weight 1)

Formatting that decorates instead of carrying the point.

- Any em dash (`—`).
- Markdown bold (`**like this**`) or markdown headings.
- Two or more emoji bullets, or two or more arrow bullets (`→`, `👉`).
- Two or more `Label: text` lines (inline-header lists).
- Three or more emoji in one post.
- Two or more hashtags.
- Broetry: eight or more lines, four in five of them four words or fewer.

## Scoring

- Slop score = 3 × hedges + every other marker.
- **Raw** = zero hedges and at most one other marker. **Polished** = any hedge, or two or more other markers. One hedge alone makes a post polished.
- The verdict compares median views of raw and polished posts over the window Threadify returns, labelled "on your account". It reports the real result, including a polished win or a tie.
- Pasted posts with no views get flags and offenders only, labelled with no view comparison.

## Sources

The rules above are original prose written for Threadify Unslop. They draw on these sources, credited here. No source text is copied.

- Wikipedia, ["Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup. Cited and linked; its text is CC BY-SA and is not reproduced here.
- [humanizer](https://github.com/blader/humanizer) by Siqi Chen (@blader). MIT License, Copyright (c) 2025 Siqi Chen.
- [no-ai-slop](https://github.com/petergyang/no-ai-slop) by Peter Yang. MIT License, Copyright (c) 2026 Peter Yang.
- The owner's Anti-Slop Protocol and Threadify's own anti-slop prompt (private, not published). Unslop overrides their hedging guidance with the zero-hedge rule above.
