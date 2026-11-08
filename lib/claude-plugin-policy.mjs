// The Claude plugin directory's rules, enforced in this repository before any
// change can reach plugins/claude. Every rule here comes from a finding the
// directory's validator or security scan actually raised on this plugin; the
// comment on each says what the directory reported. Keep the rules here and
// nowhere else: the plugin build, the git hooks and the Claude Code hook all
// call auditPluginFiles().
//
// The directory's matchers are lexical. They do not understand intent, so the
// rules below are written against the patterns, not against what the code does.

// "Files or downloads the validator couldn't inspect" and "Plugin not fully
// checked": the validator stops reading past 512 files, and holds any non-image
// file over 256 KiB or any binary that is not an image or font.
export const DIRECTORY_LIMITS = Object.freeze({
  maxFiles: 512,
  warnFiles: 470,
  maxTextBytes: 256 * 1024,
});
const IMAGE_OR_FONT = /\.(?:png|jpe?g|gif|webp|woff2?|ttf|otf)$/i;
const ALLOWED_FILE = /\.(?:md|json|mjs|js|cjs|txt|html|css|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$/i;

// Skills that drive an engine no plugin ships (Eddy) leave the plugin, and so
// does any mention of it.
const EXTERNAL_ENGINE = /eddy/i;

// "Uses a credential from the user's machine": anything that looks like a key
// or token being read from the environment, storage, files or a variable, or
// prose where a credential word sits next to a read word.
const CREDENTIAL_WORDS = ['token', 'tokens', 'secret', 'secrets', 'password', 'passwords', 'credential', 'credentials',
  'apikey', 'api_key', 'apiKey', 'accesstoken', 'access_token', 'accessToken', 'keychain', 'cookie', 'cookies', 'vault'];
const CREDENTIAL_NOUN = new RegExp(`^(${CREDENTIAL_WORDS.join('|')}|key|keys|session|sessions)$`, 'i');
// The scanner also reads 'pass' as a password and 'get…' as a read when the two words touch.
const ADJACENT_NOUN = new RegExp(`^(${CREDENTIAL_WORDS.join('|')}|key|keys|session|sessions|pass|passes|passed|passing|passwd|pwd)$`, 'i');
const ADJACENT_VERB = /^(?:read(?!y$|me$|able|ability|iness|only$)|get|fetch|load|retriev|obtain)/i;
const READ_VERB = /^read(?!y$|me$|able|ability|iness|only$)/i;
const DECLARED_CREDENTIAL = new RegExp(`\\b(?:const|let|var)\\s+(?:${CREDENTIAL_WORDS.join('|')})\\b`);
const DECLARED_KEY = /\b(?:const|let|var)\s+(?:\[\s*)?(?:key|keys|token|tokens)\b|\(\s*(?:key|keys|token|tokens)\s*\)\s*=>|\((?:[^()]*,\s*)?(?:key|keys|token|tokens)\s*[,)]|\[\s*(?:key|keys|token|tokens)\s*[,\]]|\{[^}]*\b(?:key|keys|token|tokens)\b[^}]*\}\s*(?:=|of\b|in\b|\)\s*=>)/;
const ENV_ACCESS = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[|\b)/g;
const ENV_ALLOWLIST = new Set(['THREADIFY_WORKFLOWS_HOME', 'PATH', 'PATHEXT']);
const STORAGE_ITEM = /(?:sessionStorage|localStorage)\.(?:getItem|setItem)\(\s*['"`]([^'"`]*)['"`]/g;
const ENV_REFERENCE = /\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|COOKIE)[A-Z0-9_]*\}?/;
// An environment variable named like a key, even without a $ (the scanner
// flagged "the SCRAPECREATORS_API_KEY environment variable").
const CREDENTIAL_ENV_NAME = /\b[A-Z][A-Z0-9]*_(?:[A-Z0-9]+_)*(?:API_KEY|KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)\b/;
const API_KEY_HEADER = /\bx-api-key\b/i;

// "Contains a download-and-run command": curl or wget in a script, a shell
// started with -c, a download piped into an interpreter or saved to a file, and
// a script that both talks to the network and starts processes.
const CURL_IN_CODE = /\b(?:curl|wget)\b/;
const SHELL_SPAWN = /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`](?:sh|bash|zsh|dash|cmd(?:\.exe)?|powershell|pwsh)['"`]/;
const SHELL_EXEC = /(?:^|[^.\w])(?:exec|execSync)\s*\(/m;
const CHILD_PROCESS_EXEC = /\{[^}]*\b(?:exec|execSync)\b[^}]*\}\s*from\s*['"]node:child_process['"]|child_process['"]\)\.exec/;
const PIPE_TO_INTERPRETER = /\b(?:curl|wget)\b[^\n`]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|node|python3?|ruby|perl|deno|bun)\b/;
const DOWNLOAD_TO_FILE = /\b(?:curl|wget)\b[^\n`]*\s(?:-o|-O|--output|--remote-name|--output-document)(?:\s+(?!\/dev\/null)\S|\s*$)/m;
const NETWORK = /\bfetch\s*\(|\bglobalThis\.fetch\b|\bhttps?\.(?:get|request)\s*\(|new\s+WebSocket\s*\(/;
const PROCESS = /\b(?:spawn|spawnSync|execFile|execFileSync|execFileAsync|fork)\s*\(|from\s+['"]node:child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\)/;

// The npx installer's self-updater lives outside the plugin; the directory
// updates plugin installs, and nothing in the plugin may launch it.
const INSTALLER_UPDATER = /update-on-use\.mjs|\bupdate\s+--on-use\b/;

const CODE = /\.(?:mjs|js|cjs|ts)$/;
const TEXT = /\.(?:md|json|txt|html|css|svg|mjs|js|cjs|ts)$/;

/** Problems the directory would raise for one file's content. */
export function auditFileContent(relative, content) {
  const problems = [];
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);
  if (!TEXT.test(relative)) return problems;
  if (EXTERNAL_ENGINE.test(text)) problems.push('mentions an external engine the plugin does not ship');
  if (ENV_REFERENCE.test(text)) problems.push(`credential-named environment variable reference: ${text.match(ENV_REFERENCE)[0]}`);
  if (CREDENTIAL_ENV_NAME.test(text)) problems.push(`environment variable named like a credential: ${text.match(CREDENTIAL_ENV_NAME)[0]}`);
  if (API_KEY_HEADER.test(text)) problems.push('sends an API key header (x-api-key)');
  if (PIPE_TO_INTERPRETER.test(text)) problems.push('download piped into an interpreter');
  if (DOWNLOAD_TO_FILE.test(text)) problems.push('download saved to a file with curl or wget');
  // Scripts and instructions only; JSON provenance records may name the source file.
  if (/\.(?:md|mjs|js|cjs|ts)$/.test(relative) && INSTALLER_UPDATER.test(text)) {
    problems.push("runs the installer's self-updater, code from outside the plugin");
  }
  if (CODE.test(relative)) {
    for (const match of text.matchAll(ENV_ACCESS)) {
      if (!match[1] || !ENV_ALLOWLIST.has(match[1])) problems.push(`environment access ${match[0]}`);
    }
    for (const match of text.matchAll(STORAGE_ITEM)) {
      if (CREDENTIAL_NOUN.test(match[1]) || /(?:token|secret|password|credential|session|auth|key)/i.test(match[1])) {
        problems.push(`storage item named like a credential: ${match[1]}`);
      }
    }
    if (DECLARED_CREDENTIAL.test(text)) problems.push(`variable named like a credential: ${text.match(DECLARED_CREDENTIAL)[0]}`);
    if (DECLARED_KEY.test(text)) problems.push(`variable named like a key or token: ${text.match(DECLARED_KEY)[0].trim()}`);
    if (CURL_IN_CODE.test(text)) problems.push('runs or builds a curl or wget command');
    if (SHELL_SPAWN.test(text)) problems.push(`starts a shell: ${text.match(SHELL_SPAWN)[0]}`);
    if (CHILD_PROCESS_EXEC.test(text) || (/child_process/.test(text) && SHELL_EXEC.test(text))) problems.push('uses child_process exec, which runs through a shell');
    if (NETWORK.test(text) && PROCESS.test(text)) {
      problems.push('talks to the network and starts processes in the same file; move the network calls to their own module');
    }
  }
  const words = [...text.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)].map((match) => match[0]);
  for (let index = 0; index < words.length - 1; index += 1) {
    const next = words[index + 1];
    if (ADJACENT_NOUN.test(words[index]) && ADJACENT_VERB.test(next)) {
      problems.push(`credential word directly before a read verb: "${words[index]} ${next}"`);
    } else if (ADJACENT_VERB.test(words[index]) && ADJACENT_NOUN.test(next) && !/^sessions?$/i.test(next)) {
      problems.push(`read verb directly before a credential word: "${words[index]} ${next}"`);
    }
  }
  for (let index = 0; index < words.length; index += 1) {
    const window = words.slice(index + 1, index + 4);
    if (CREDENTIAL_NOUN.test(words[index]) && window.some((word) => READ_VERB.test(word))) {
      problems.push(`credential noun next to a read verb: "${words[index]} ... ${window.find((word) => READ_VERB.test(word))}"`);
    } else if (READ_VERB.test(words[index]) && window.some((word) => CREDENTIAL_NOUN.test(word) && !/^sessions?$/i.test(word))) {
      problems.push(`read verb next to a credential noun: "${words[index]} ... ${window.find((word) => CREDENTIAL_NOUN.test(word))}"`);
    }
  }
  return [...new Set(problems)];
}

/**
 * Problems the directory would raise for a whole plugin folder.
 * `files` is every file in the folder as [relativePath, Buffer] pairs.
 * Returns { problems, warnings }; any problem must block the change.
 */
export function auditPluginFiles(files) {
  const problems = [];
  const warnings = [];
  if (files.length > DIRECTORY_LIMITS.maxFiles) {
    problems.push(`${files.length} files: the directory stops checking past ${DIRECTORY_LIMITS.maxFiles} and holds the plugin as not fully checked`);
  } else if (files.length > DIRECTORY_LIMITS.warnFiles) {
    warnings.push(`${files.length} of ${DIRECTORY_LIMITS.maxFiles} files used: trim or exclude before adding more skills`);
  }
  for (const [relative, content] of files) {
    if (!ALLOWED_FILE.test(relative)) problems.push(`${relative}: file type the directory can't inspect`);
    if (!IMAGE_OR_FONT.test(relative) && content.length > DIRECTORY_LIMITS.maxTextBytes) {
      problems.push(`${relative}: ${Math.ceil(content.length / 1024)} KiB, over the ${DIRECTORY_LIMITS.maxTextBytes / 1024} KiB the directory inspects`);
    }
    for (const problem of auditFileContent(relative, content)) problems.push(`${relative}: ${problem}`);
  }
  return { problems, warnings };
}
