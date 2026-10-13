# Reverse Engineer My App

**The problem:** you built an app, a course, a community or a service. It is good. Almost nobody knows it exists, and every time you sit down to post about it you write "check out my thing", or nothing at all.

**What you get:** a plain-English map of what your product actually does, with proof for every feature, then 7 posts written in your voice by Threadify. One real feature a day, each with a tracked link to your offer, all scheduled after one "yes". You stop guessing what to post, and every post sells something true.

**Why now:** tools like REA can x-ray and copy any app in an afternoon. Building is cheap, distribution is expensive. Nobody can copy you showing up every day with proof.

**Works with:** a web app you own (REA scans it logged out), the page for anything you sell (course, service, community, newsletter, product), or a feature list you paste. It runs the same in Claude Code, Codex and ChatGPT.

Use the complete [installable skill](../../skills/threadify-reverse-engineer-my-app/SKILL.md). In Claude Code type `/threadify-reverse-engineer-my-app https://your-app.com`. In Codex type `$threadify-reverse-engineer-my-app https://your-app.com`.

1. Confirm your Threads account and timezone.
2. One question first: do you own this app, or have written permission to analyse it? Anything but "yes" stops the workflow and nothing is scanned. REA's own rule is the same: it is for software you own or are authorized to examine.
3. Give it one of three things:
   - the address of a web app you own. REA looks at it logged out, in a fresh browser profile signed in to nothing, for 5 seconds.
   - no REA yet? The workflow offers `npx rea-agents setup`, the official package from github.com/morluto/rea only (lookalike packages exist), and installs it only after your "yes".
   - no app to scan? Your product or offer page, or a feature list you paste.
4. You get a feature map: 5-10 features in plain English, each with evidence (the exact place REA found it in the app's code, or an exact quote from your page), plus what REA could not tell. It never claims what happens on your server. Anything that looks like a key, an account id or an email is hidden before you see it.
5. You pick 7 features. Each becomes one post brief, one per day, each from a different angle: what it does, why you built it, the problem it kills, behind the scenes, a fact from the map, the "building is cheap, distribution is expensive" take, and a real user win (only if you give one).
6. Threadify writes every post in your voice and reports the model it used. Your agent never writes or rewrites a word; the one change it makes is lowercasing, and a casing guard proves `lower(original) == lower(final)`. A post that mentions a feature or a number that is not in your map is rejected and written again.
7. Each post gets a tracked Auto Plug for your offer, 50 minutes after it goes out.
8. One approval card shows all 7 posts, their plugs and their times in your timezone. Nothing is scheduled until you reply "yes". After the yes, every post is scheduled once, read back, and kept in a receipt with no post text in it.

A feature map is what the app shows and what its browser code does, not a promise about how it works behind the scenes. A scheduled post is not a published post.
