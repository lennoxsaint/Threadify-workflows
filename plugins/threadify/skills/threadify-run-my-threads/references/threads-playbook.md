# Threads playbook

Rules the agent passes to Threadify in `inputText` and uses to check each post Threadify returns.

## What the agent may and may not do

- The agent picks the archetype, structure, post type and CTA instruction, and names them in `inputText`. Threadify writes the copy.
- The agent uses these rules to check a post. It never edits, rewrites or shortens copy. A failed check means: drop the post or ask Threadify for a replacement, and say why.
- Every claim, number, name and result must come from the creator's own context (Brain, past posts, offer). Never ask Threadify to invent a fact, stat, quote, client or result. A number goes in only if it really happened.

## How to ask Threadify (inputText skeleton)

```text
Topic lane: <lane>. Fresh angle, not a repeat of recent posts.
Post type: <shortFormType or longFormType>. Structure: <structure id>.
Hook archetype: <archetype id> - <one-line shape from this playbook>.
Hook rules: first 3-5 words carry it; first sentence 4-8 words; hook <= 3 lines and <= 200 characters; no banned opener.
Use only true details from my context; a number only if it really happened.
CTA: <none | engagement ask | conversion ask for offer "<name>">, placed <in the final post / in post 2>.
```

## Hook

- The first post has one job: make the right reader stop. If the hook fails, nothing else gets read.
- The first 3-5 words carry the hook. Front-load the most concrete word: a name, a place, a moment, a true number.
- In the first 5 words, use one specific, true detail; a number only if it really happened.
- Use "I" or "you" early. It turns a statement into a conversation.
- First sentence: 4-8 words preferred, and it opens a loop.
- Hook length: <= 3 lines on a phone and <= 200 characters. Long-form post 1 may add one plan line.
- One premise per hook. Do not stack three unrelated ideas or a string of numbers that do not cohere.
- End the hook with a hold signal when more follows (a colon, or "Here's how:"). Never cut a sentence in half to fake suspense.
- No link, offer or ask in the hook.
- Be bold but truthful. No fake urgency, no "the only secret", no promise the post cannot keep.

### PPP: proof, promise, plan

- **Proof** - why believe this? Earned (something the creator did), shown (a real before and after) or borrowed (a named, real source, quoted accurately).
- **Promise** - what is in it for the reader? Save time, solve a named pain, or make something easier.
- **Plan** - what are they getting? Name the format and count: "5 mistakes:", "the 3 steps:", "Here's how:".
- Pain is an optional fourth P: name the "before" state in concrete terms the reader knows.

### Open two loops

- Loop 1, story: a beat that makes the reader ask "what happened next?"
- Loop 2, deliverable: a promised payoff that makes them ask "what are the steps?"
- Both loops must be closed by the end of the post or thread.

### The 6 hook patterns

Rotate patterns to avoid fatigue. Fill every slot with true details only.

1. **Age + Years** - "I'm [age]. After [years] in [field], [insight]:" Only when the age and years are real.
2. **Before-After** - "At [time], I was [state]. Now I'm [state]."
3. **Contrarian Claim** - "[Opposite of a common belief]. Here's why:"
4. **Paradox Introduction** - "[Two things that seem to contradict]. Here's the paradox:"
5. **Direct Question** - "If you're [specific situation], read this:" (a call-out, not a yes/no question).
6. **Micro-Scene** - "[Sensory detail]. [Sensory detail]. [Place or time]:"

Pick a pattern by job: teaching with personal proof = Age + Years; transformation = Before-After; counter-intuitive lesson = Contrarian Claim; unexpected insight = Paradox Introduction; one specific reader = Direct Question; dramatic moment = Micro-Scene.

### The 10 hook archetypes

The planner uses these ids exactly. Source names are in brackets. Templates live in `hook-bank.md`.

| id | Source name | Shape |
| --- | --- | --- |
| `contrarian` | Hard Truth / Controversial Statement | A common belief, then the part that is wrong. Useful, not just spicy. |
| `confession` | Authority + Vulnerability | Something the creator got wrong or hid, said plainly. |
| `curiosity-gap` | Story Tease / Surprising Fact | Name a surprising true thing, withhold the why. Facts must be real and sourced. |
| `before-after` | Personal Transformation / Defining Moment | A real "then" and "now", or the day it changed. |
| `list-promise` | List Preview / Numbered Lists | A count and a payoff: "[N] [things] I wish I knew about [topic]:" |
| `how-to` | How-To (with a Twist) | "How to [outcome] without [common obstacle]:" |
| `mistake` | Direct Command / Empathy-Pain | Stop/start, or "the mistake most [people] make with [topic]". |
| `observation` | Age/Experience / Audience Call-Out | Name what people do or feel and do not say out loud. |
| `proof-receipt` | Achievement/Number | A real result and timeframe, then "here's what did it:" |
| `story-open` | Vivid Scene | Drop the reader into one moment, mid-action. |

- An Audience Call-Out ("If you're a [who] who [pain]...") can front any archetype.
- Do not use the same archetype twice in one day's batch unless fewer than five fit the creator's context.

### Banned openers

A post must not start with any of these (case-insensitive, after trimming). `scripts/hook-check.mjs` uses this exact list:

- In today's
- I want to talk about
- Let's talk about
- Here's the thing
- Did you know
- Have you ever wondered
- Ever wonder
- Unpopular opinion:
- Hot take:
- Thread 🧵
- 🧵
- Buckle up
- So,
- I've been thinking
- Let me tell you
- Today I want to
- In this thread
- A thread on
- Let's dive in
- I don't know who needs to hear this
- Are you struggling
- Do you want to
- Hey everyone
- Fun fact:
- What if I told you
- Picture this
- Imagine this
- Hey guys
- Hi everyone
- Just wanted to
- Friendly reminder
- In this post

Also fails: a warm-up line before the real opener, a yes/no question the reader can answer "no" to, 🔥 or 🚀 in the hook, ALL CAPS shouting.

## Hold

- One idea per line. Each line earns the next.
- Whitespace is punctuation. 1-3 short sentences per block; no walls of text.
- Numbers over adjectives, and only true numbers. "3 clients" beats "many clients"; no number beats a made-up one.
- Exact over vague: a named tool, place, day or person (with permission) instead of "recently", "various", "several".
- Put proof at the peak of doubt: the moment the reader thinks "really?", show the receipt (screenshot, real result, quote).
- Use SCAR for each point or micro-story:
  - **Setup** - the context in one line ("I posted every day for a month.")
  - **Conflict** - the problem, often with "but" ("But replies dropped.")
  - **Action** - what was done, often with "so" ("So I cut to one post and replied to everyone.")
  - **Result** - the real outcome, stated plainly. No invented figures.
- Reading level: grade 4-5. Short words, short sentences, active voice, contractions.
- Vary sentence length. Fragments are fine.
- Max 3 emoji in a whole thread.
- List items: parallel syntax, same shape each line.

### Banned slop words and phrases

`scripts/hook-check.mjs` fails a hook that uses any word or phrase in the first four bullets and warns when one appears later in the post. Avoid the rest too:

- delve, game-changer, unlock, leverage, utilize, synergy, paradigm, robust, ecosystem, holistic, seamless, cutting-edge
- transformative, revolutionary, disruptive, innovative, best-in-class, empower, streamline, supercharge, elevate
- realm, tapestry, foster, nuanced, myriad, plethora, showcase, vibrant, furthermore, moreover
- in today's fast-paced world, in today's world, navigate the landscape, at the end of the day, it's important to note, in conclusion, in summary, when it comes to, let's dive in
- "not only... but also", "not just X, but Y"
- "It's not just X, it's Y" more than once per post
- Em-dash overload: more than one em dash per post
- Triple repetition ("very very very") and stacked rhetorical questions

## Help

- Deliver all the value before any ask. The reader should be able to use the post without clicking anything.
- Close every loop the hook opened. If the hook promised 5 steps, there are 5 steps.
- End on a payoff: the last useful insight, a one-line takeaway, or a cheat-sheet recap of the steps (long-form).
- The final line should be quotable or usable today.

## CTA

- A plug IS a CTA. Count it as one.
- Never a CTA, offer or link in post 1.
- **Rule of Two**: at most 1 engagement ask + at most 1 conversion ask per post or thread, each in its own post. One is better than two. Never two of the same type.
- When using two: penultimate post = engagement ask; final post = conversion ask.
- **RSS test** - fail any and do not ship:
  - **Relevant** - continues the same conversation as the post.
  - **Specific** - names the exact asset, offer or next step. "Resources in my bio" fails.
  - **Seamless** - reads like the next line, not an afterthought.
- One verb, one step: Open / Grab / Join / Follow / Comment / Repost. No scavenger hunts.
- Lead with the benefit to the reader. Tone-match the post: a story never gets a hard sell.
- **Magnet -> Bridge -> Door**: the last useful insight (magnet) -> the CTA line (bridge) -> the named offer or asset (door).
- Decision tree by what the post delivered:
  - story / personal shift -> engagement ask (a reply question that continues the conversation)
  - how-to / tactical -> asset or conversion ask (the named offer that helps them do it)
  - listicle / principles -> follow or repost ask
- The plug lives in a reply or the final post, never the hook.
- Rotate engagement and conversion asks across days to avoid ask fatigue. Not every post needs an ask.
- Conversion links come from the Threadify offer so they are tracked. Never invent a URL, price, discount, member count or social proof.
- No offer saved: use an engagement ask or none.

## Structures

The planner uses these 9 structure ids:

- `listicle` - hook with a count -> 5-7 parallel items -> one-line payoff.
- `setup-twist-mic-drop` - common belief -> the twist -> a short, quotable close.
- `contrarian-reversal` - the popular advice -> why it fails -> what to do instead.
- `before-after` - the real "before" -> the turning point -> the real "after" -> the lesson.
- `confession` - what was got wrong -> what it cost -> what changed -> the takeaway.
- `story-arc` - context -> tension -> the moment it turned -> reflection -> lesson.
- `step-by-step` - outcome promised -> numbered steps (what, why, how) -> recap.
- `proof-receipt` - a real result -> what produced it -> how the reader can try it.
- `observation` - name a thing people do or feel -> one specific detail -> what it means.

## Short-form types

Threadify `shortFormType` values:

- `one-liner` - under 280 characters (150-200 ideal), about 15-25 words, 2-4 line breaks. Setup -> twist -> mic-drop, one line each. One idea, no ask.
- `listicle` - hook + 5-7 parallel items, <= 450 characters. One line per item. Ends with a one-line takeaway, no external ask.
- `listicle-plug` - a listicle whose CTA lives in post 2 (the reply). Post 1 is pure value with no link or ask. Post 2 passes RSS and names the offer. Needs a saved offer; without one, use `listicle`.
- `random` - a human, conversational post (observation, open question, behind-the-scenes, honest confession, small win). Built for replies over reach. Keep it real; no invented milestones.

## Long-form

Threadify `longFormType` values. Shape: hook = 1 post, hold = 5-7 posts, help = 1-3 posts; about 6-12 posts in total, about 250-300 characters per post.

- `teacher` - PPP hook -> one numbered step per post (what, why, how, with a real example) -> cheat-sheet recap -> CTA. Best CTA: the asset or offer that helps them do it.
- `storyteller` - a story loop in post 1 (a real struggle, a moment, a line someone said) -> context -> rising tension -> the moment it turned -> reflection -> lesson -> CTA. Best CTA: a reply question.
- `synthesizer` - proof borrowed from a named, real source (book, talk, study) -> one lesson per post (principle, why, how, evidence from the source) -> cheat-sheet recap -> CTA. Quote and attribute accurately; never invent a quote or figure.

Long-form checks: every hold post closes its own mini-loop; the thread closes the hook's loops; at most two asks, each in its own post, never in post 1.
