# Corpus cache layout

`scripts/watch-any-creator.mjs analyse --corpus <folder>` reads this folder. Any puller that writes it this way works: the skill's own pull, a script run before filming, or a hand-made export.

```text
<corpus>/
  manifest.json                 required
  channel.json                  optional: raw channel lookup response
  videos/page-0001.json ...     raw long-form listing pages, any sort, in any number
  shorts/page-0001.json ...     raw Shorts listing pages
  transcripts/<videoId>.json    one raw transcript per long-form video (.txt also works)
```

## manifest.json

```json
{
  "record_type": "WatchAnyCreatorCorpusV1",
  "creator_handle": "@CreatorHandle",
  "provider": "scrapecreators",
  "observed_at": "2026-10-10T02:00:00Z",
  "auth_mode": "byo_key",
  "rights_basis": "public metadata and transcripts, analysed privately; transcripts never redistributed",
  "counts": { "long_listed": 524, "shorts_listed": 4476, "transcripts": 524 },
  "credits": { "estimated": 637, "charged": 640 },
  "endpoints": ["/v1/youtube/channel", "/v1/youtube/channel-videos", "/v1/youtube/channel/shorts", "/v1/youtube/video/transcript"]
}
```

`creator_handle`, `provider` and `observed_at` (ISO) are required. `counts` is checked against the files: a difference is reported as a gap and the source is marked incomplete. `counts.long_listed` and `counts.shorts_listed` count listing entries across every page, duplicates included (a video in both the popular and the latest sort counts twice there and once in the analysis).

## Pages

Each page file is the provider's response saved unchanged. The reader takes the entries from `videos`, `shorts`, `items` or `data`, or from a top-level array. Per entry it uses:

| Field | From (first one present) |
| --- | --- |
| video id | `id`, `videoId`, or the `v=` / `/shorts/` part of `url` |
| title | `title` |
| format | `type` (`short` or `video`), else the folder (`shorts/` or `videos/`) |
| views | `viewCountInt`, else `viewCountText` when it is plain digits ("3.5K" stays unknown) |
| likes, comments | `likeCountInt`, `commentCountInt` |
| published | `publishDate`, `publishedTime`, `published_at`, `uploadDate`, `createdAt` |
| length | `lengthSeconds`, `durationMs`, `duration`, `durationFormatted`, `lengthText` |

An entry whose `channel.handle` names another channel is skipped and counted. `credits_charged` on any page or transcript is summed into `credits_charged_in_cache`.

## Transcripts

`transcripts/<videoId>.json` holds the raw response. Timed segments (`transcript` or `content` arrays with `startMs`, `offset` in milliseconds, or `start` in seconds) give the exact first 60 seconds. Untimed text (`transcript_only_text`, `content`, `text`, or a `.txt` file) gives the first 150 words. Only measured features and a quote of at most twelve words leave the analysis.

## ScrapeCreators calls (Oct 2026)

Base `https://api.scrapecreators.com`, one credit per call, the key in the `x-api-key` header from the environment, never in a file.

| Call | Path and query | Page size seen |
| --- | --- | --- |
| channel lookup | `/v1/youtube/channel?handle=<handle>` | - |
| long-form list | `/v1/youtube/channel-videos?handle=<handle>&sort=popular` (or `latest`), then `&continuationToken=<from the last page>` until none | 30 |
| Shorts list | `/v1/youtube/channel/shorts?handle=<handle>&sort=popular` (or `newest`), same paging | 48 |
| transcript | `/v1/youtube/video/transcript?url=https://www.youtube.com/watch?v=<id>` | - |

Estimate before pulling: `node scripts/watch-any-creator.mjs estimate --long 524 --shorts 4476` prints the calls and credits.
