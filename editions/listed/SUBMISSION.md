# Submitting the listed edition

This is the owner's checklist for sending Threadify to OpenAI's plugin directory. The package in `package/threadify/` is built and checked by code. Everything below is a step that only the owner (or, where marked, the lead engineer) can take, because it needs an account, a decision or production access.

OpenAI's own pages are the source of truth: [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission) and [Plugin submission errors](https://developers.openai.com/plugins/deploy/submission-errors).

## What is already in the package

- Twelve skills that run with only the Threadify MCP server, including Get Set Up, Create My Week and Inbound Replies. No plans links, costs, trials, upgrade prompts or local helpers.
- Every skill that schedules calls `review_post` first, and Inbound Replies calls `review_reply` before each send. Both need the server changes in threadify-app#242, #244 and #248 deployed before the private ChatGPT test.
- `plugin.json` with the listing text, four listing URLs, three starter prompts, 5 positive and 3 negative review cases, release notes, `commerce: false`, and `publication.countries: []`.
- A demo video link that is still a placeholder. `--final` refuses to pass until you replace it.

## Before you upload

Tick each one. Most of them are done once.

1. **Publisher identity.** At [platform.openai.com](https://platform.openai.com), verify **Saints Coaching** as the business that publishes the plugin. The directory shows the verified name, whatever `developerName` says in the package, so check that the verified name is the one you want people to see.
2. **Plugin-management role.** Make sure your OpenAI account has the plugin-management role in that organization, so the Plugins page lets you upload and submit.
3. **Public pages are live.** threadify-app#231 must be deployed to production first. It adds the public help page (`/help`, the support URL) and the ChatGPT guide (`/guides/chatgpt`, the website URL). Today, signed out, both answer with a redirect to `/login`. The privacy and terms pages already pass.
4. **Domain challenge token (lead engineer).** The portal shows a token for this plugin. The lead engineer puts that exact token, as plain text and nothing else, at `https://www.threadify.app/.well-known/openai-apps-challenge` on production. That address serves a token today. Check that it is the token the portal shows for this plugin, and do not overwrite a token another app still needs; ask OpenAI support if both are needed.
5. **Logo approval.** Look at `assets/logo.png` (1024 px) and `assets/icon.png` (512 px) and approve them as the directory images. If you want different art, replace those two files (square PNG) and rebuild.
6. **Country list.** Decide where the plugin should be available. Write the two-letter codes into `publication.countries` in `edition.json`, for example `["AU", "US", "GB"]`. Leaving `[]` means every country with no restriction; the `--final` check warns about that so it is a choice, not an accident.
7. **Reviewer account.** Create a Threadify account just for OpenAI's reviewers:
   - an active plan, so no tool in the test cases is refused;
   - a sandbox Threads account connected to it, made for testing, with at least five posts that are more than 7 days old, so "best posts in the last 90 days" has real results;
   - one post scheduled 30 or more days out, so the "move then cancel" case has something to move;
   - no X account connected (cross-posting then shows its plain fallback, and nothing posts to X);
   - email and password sign-in that works straight away, with no MFA, no email or SMS code, no magic link and no Google-only sign-in.

   The login goes in the dashboard's **Review details** form, never in the package. Keep the account and its sample posts in place for later reviews.
8. **Demo video.** Record it from the outline below and upload it where a reviewer can watch without signing in (for example, an unlisted YouTube video). Put the link in `review.demo_recording_url` in `edition.json`.
9. **Rebuild and run the final checks** from the repository root:

   ```sh
   node editions/listed/build.mjs
   node editions/listed/build.mjs --check
   node editions/listed/preflight.mjs editions/listed/package/threadify --final --online
   ```

   `--final` must show no errors. `--online` reads the live site signed out, so run it after step 3 and step 4 are done. Commit the rebuilt package.

## Upload and submit

1. Make the ZIP from inside the plugin folder, so `plugin.json` sits at the top of the ZIP:

   ```sh
   cd editions/listed/package/threadify
   zip -r -X ~/Desktop/threadify-listed-1.0.0.zip . -x '.DS_Store'
   ```

2. On the Plugins page, start a submission **With MCP** and upload the ZIP. Fix any finding in **Metadata & Skills** and upload again if needed. Skill scans can take up to 2 hours.
3. Under **MCPs**, complete the domain check, connect the server and sign in, then let the tool scan finish.
4. Open **Review information → Review details**. Check the imported test cases and release notes, enter the reviewer login, and paste the reviewer notes below.
5. Choose **Submit for review** and complete the policy attestations. Read each one; they are statements made by the owner.
6. Watch **Review status** and your email. If the review asks for changes, change the package or the server, rebuild, rerun the checks, and upload again.

## Reviewer notes

Paste this into **Review details**, after the login.

> Threadify helps a creator write, schedule and manage posts for their own Threads account, in their own voice.
>
> The test account is connected to a sandbox Threads account made for this review. Posts on it are public but exist only for testing.
>
> Nothing is scheduled until the person has seen the exact review. `review_post` shows the post, the account, the time and each platform's version, and returns an approval that `schedule_post` needs. If anything changes, the assistant reviews again. Approvals expire after 15 minutes.
>
> Please schedule test posts at least a day ahead and cancel them when you are done; test case 5 shows how. The account has no X account connected, so cross-posting to X shows a plain fallback instead of posting.
>
> The plugin never shows plans, costs or payment pages. Account options are managed on threadify.app.

## Demo video outline

About 5 minutes, on ChatGPT on the web, with a short check in Codex at the end. Use the reviewer account. Speak plainly and show each result on screen.

1. **Add and connect (40 s).** Open the plugin, choose Connect, sign in on the Threadify screen, approve the access shown, and return to the chat.
2. **Case 1, connection and calendar (30 s).** "Which Threads account is Threadify connected to, and what do I have scheduled for the next 7 days?" Show the handle, the timezone and the calendar.
3. **Case 2, draft without scheduling (40 s).** Ask for a short post in your voice and say not to schedule it. Show the draft, and show that the calendar did not change.
4. **Case 3, review, approve, schedule (60 s).** Ask to schedule a post for tomorrow at 9am. Pause on the review: text, account, time, platform. Change the time once to show that a new review appears. Say yes. Show the readback.
5. **Case 4, best posts (30 s).** "What were my best Threads posts in the last 90 days, ranked by views?"
6. **Case 5, move then cancel (45 s).** Move the next scheduled post to Friday at 6pm, read back the new time, then cancel it and show it is off the calendar. Cancel the post from case 3 the same way.
7. **Negative cases (45 s).** Ask for a banana bread recipe (no Threadify tool runs). Ask to post on a friend's account (declined). Ask to upgrade and see costs (no plans, amounts or payment links).
8. **Codex (20 s).** In Codex, with the same plugin installed, ask what is scheduled this week and show the same answer.

## After approval

Publishing is a separate step you choose. After the plugin is published, OpenAI issues the direct install link; set it in threadify-app (`THREADIFY_CHATGPT_PLUGIN_URL`) so the site's install card appears. Server changes are picked up by OpenAI's daily scan. A change to skills or listing text needs a new version in `edition.json`, a rebuild and a new ZIP.
