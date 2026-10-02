# Workspace formats

The files that hold a learner's progress. The shapes are adapted from Matt Pocock's `teach` skill - see [attribution](ATTRIBUTION.md).

Create each file only when it is first needed. Keep all of them in the learner's private folder.

## MISSION.md

One mission per workspace. Keep it under a screen.

```md
# Mission: Threads

## Why
{1-3 sentences. What changes for the learner if Threads works. A real outcome, not "get better at Threads".}

## What I sell or want
{The offer, or the thing they want people to do after finding them. "Nothing yet" is a valid answer.}

## Who it is for
{One real person, described plainly.}

## Success looks like
- {Something you could see happen}
- {Another one}

## Limits
- {Time per week, topics they will not post about, anything else that bounds the work}

## Not now
- {Things the learner does not want to chase yet}
```

Rules:

- Concrete beats abstract. "Two client calls a month from Threads" beats "grow my audience".
- If the learner cannot say why, keep asking before writing anything.
- When the goal moves, confirm it with the learner, update the file and add a learning record.

## learning-records/0001-slug.md

Numbered in order. Find the highest number in the folder and add one.

```md
# {Short title of what was learned or established}

{1-3 sentences: what the learner can now do, already knew, or got wrong and fixed - and what that changes about the next lesson.}
```

A record can be one paragraph. Add these lines only when they help:

- `Status: active` or `Status: superseded by 0007`
- `Evidence:` how the learner showed it, such as the post they wrote or the question they answered
- `Next:` what this opens up or rules out

Write a record when:

1. The learner showed they can use a framework, not just that it was covered.
2. The learner told you they already knew something. Note how deep.
3. A misunderstanding was fixed. These predict where they will trip next.
4. The mission changed.

Do not write a record for material that was only covered, or to log what happened in a session. When a later record corrects an earlier one, mark the old one superseded and keep it.

## lessons/0001-slug.md

The lesson as the learner took it, short enough to reread in two minutes.

```md
# Lesson {n}: {title}

Mission link: {one line on why this lesson matters for their mission}

## The idea
{The principle in plain language}

## Example
{The worked example, marked as an example}

## In your posts
{What their own posts showed. Say "sample" when the posts were pasted.}

## Watch for
{The common mistake}

## You practiced
{The task and what they produced}

## Your post
{Link to the post file}

Ask me anything about this lesson next time.
```

## posts/0001-slug.md

```md
# Post from lesson {n}

Status: written | draft_saved | scheduled_confirmed | schedule_unverified | handed_over | failed
Account: {@handle or unknown}
Scheduled for: {local date, time and timezone, or none}

{The exact final text the learner wrote}

Result: {what the learner later reports or a read tool later shows - unknown until then}
```

Change the status only after readback. `handed_over` means the learner took the text to schedule themselves.

## GLOSSARY.md

```md
# Threads glossary

**Hook**:
The first line of a post, where the reader decides whether to keep going.
_Avoid_: headline, intro
```

Rules:

- Add a word only once the learner uses it correctly.
- Pick one word for each idea and list the ones to avoid.
- One or two sentences. Say what it is.
- Use the same words in every later lesson.

## NOTES.md

Free-form. How the learner likes to be taught, what they do not want, and anything to remember next time. No private details about other people.
