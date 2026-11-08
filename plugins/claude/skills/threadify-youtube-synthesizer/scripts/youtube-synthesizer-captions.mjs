// Process launching for YouTube Synthesizer, kept apart from
// youtube-synthesizer.mjs, which reads public metadata and captions over the
// network. One rule for every bundled script: a file that talks to the network
// never starts processes, and the reverse.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Run yt-dlp with prepared caption arguments; captions land in the output template's folder. */
export async function runYtDlp(executable, args) {
  await execFileAsync(executable, args, {
    timeout: 120_000,
    maxBuffer: 1_000_000,
    windowsHide: true,
  });
}
