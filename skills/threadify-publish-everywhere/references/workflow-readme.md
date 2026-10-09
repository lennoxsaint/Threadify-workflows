# Publish Everywhere

"One video. Three places. One yes."

Use the complete [installable skill](../../skills/threadify-publish-everywhere/SKILL.md). In Claude Code type `/threadify-publish-everywhere`. In Codex type `$threadify-publish-everywhere`.

Hand your agent one video. It checks where the video can go, has Threadify write the post and the YouTube title in your voice, and schedules it to YouTube, Threads and X only after one exact approval.

First it reads back your brand and each connected account by handle. If YouTube is not connected it stops and tells you to connect it at threadify.app (Brands). It never switches account without asking.

Then it measures the video on your computer: size, length, shape and file type. Only MP4 or MOV. Each platform gets a plain answer:

| Where | Limit |
| --- | --- |
| Threadify storage, every platform | 1 GB (1024 MB) |
| Threads | 300 seconds (5 minutes) |
| X | 20 minutes by default |
| YouTube | 12 hours; a channel not cleared for long uploads is held to 15 minutes |

A platform that cannot take the video is dropped, and you are told why. Vertical or square video of 3 minutes or less goes to YouTube as a Short. Everything else goes as a long video.

Threadify writes the post from your one-line description of the video. The YouTube title is the first line of that post unless you give one (100 characters at most). Your agent never writes or rewrites a word. The one change it can make is lowercasing, and a casing guard proves `lower(original) == lower(final)`.

Your agent asks you for the YouTube privacy (public, unlisted or private) every time. It never picks one for you, and it never marks a video as made for kids without asking.

You see one approval card: the exact post, the YouTube title, format and privacy, each platform with its handle and time, anything dropped and why, and a note if global auto-repost is on. X is metered, and the card says so. Nothing is scheduled until you reply "yes".

After the yes it schedules once and reads the result back per platform. If an answer is unclear it checks the calendar before trying again. One video per run. Nothing is deleted. A scheduled post is not a published post.

The limits live in [platform-limits.json](../../skills/threadify-publish-everywhere/references/platform-limits.json).
