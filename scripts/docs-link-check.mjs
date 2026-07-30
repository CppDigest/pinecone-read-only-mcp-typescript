/**
 * Run markdown-link-check once for README, CHANGELOG, and every *.md under docs/.
 * Avoids per-file `npx` invocations (slow / flaky under registry hiccups).
 *
 * markdown-link-check verifies that link *targets* (files/URLs) exist, but does not
 * reliably validate heading *fragments* (`file.md#some-heading`), especially across
 * files (tcort/markdown-link-check#212, #225). `checkHeadingAnchors` below closes that
 * gap with a self-contained GitHub-slug implementation (no extra dependency) so a
 * renamed/retitled heading that leaves a dangling `#anchor` fails CI.
 */
import { spawnSync } from 'node:child_process';
import { error, log } from 'node:console';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @param {string} dir @returns {string[]} */
function walkMarkdownFiles(dir) {
  const out = [];
  try {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) out.push(...walkMarkdownFiles(p));
      else if (ent.isFile() && ent.name.endsWith('.md')) out.push(p);
    }
  } catch {
    // missing or unreadable dir
  }
  return out;
}

/** @returns {string[]} */
export function defaultMarkdownPaths() {
  return ['README.md', 'CHANGELOG.md', ...walkMarkdownFiles('docs')];
}

/**
 * ASCII + common Unicode punctuation stripped by GitHub's heading slugger
 * (verified against `github-slugger@2` output for every heading in this repo's
 * docs). Deliberately excludes `-` and `_`, which GitHub preserves.
 */
const SLUG_STRIP_RE = /[!-,./:-@[-^`{-~\u00A1-\u00BF\u00D7\u00F7\u2000-\u206F\u2190-\u21FF]/g;

const CODE_SPAN_PLACEHOLDER = '@@CODESPAN';

/** @param {string} text @returns {string} */
export function stripInlineMarkdown(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]*)`/g, (_m, inner) => {
    codeSpans.push(inner);
    return `${CODE_SPAN_PLACEHOLDER}${codeSpans.length - 1}@@`;
  });
  out = out.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*([^*]*)\*/g, '$1');
  const placeholderRe = new RegExp(`${CODE_SPAN_PLACEHOLDER}(\\d+)@@`, 'g');
  return out.replace(placeholderRe, (_m, i) => codeSpans[Number(i)]);
}

/** @param {string} text @returns {string} */
export function slugify(text) {
  return stripInlineMarkdown(text).toLowerCase().replace(SLUG_STRIP_RE, '').replace(/ /g, '-');
}

/** @param {string} content @returns {Set<string>} */
export function headingSlugs(content) {
  const slugs = new Set();
  const occurrences = Object.create(null);
  let inCodeBlock = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    const base = slugify(m[2]);
    let slug = base;
    if (Object.prototype.hasOwnProperty.call(occurrences, base)) {
      occurrences[base]++;
      slug = `${base}-${occurrences[base]}`;
    } else {
      occurrences[base] = 0;
    }
    slugs.add(slug);
  }
  return slugs;
}

/** @param {string} line @param {number} lineNo @param {Array<{line: number, target: string}>} links */
function extractFragmentLinksFromLine(line, lineNo, links) {
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  line.split('`').forEach((segment, i) => {
    if (i % 2 === 1) return;
    let m;
    while ((m = linkRe.exec(segment)) !== null) {
      const target = m[1].trim();
      if (/^https?:\/\//.test(target) || target.startsWith('mailto:')) continue;
      if (!target.includes('#')) continue;
      links.push({ line: lineNo, target });
    }
  });
}

/** @param {string} content @returns {Array<{line: number, target: string}>} */
export function extractFragmentLinks(content) {
  const links = [];
  let inCodeBlock = false;
  content.split(/\r?\n/).forEach((line, idx) => {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;
    extractFragmentLinksFromLine(line, idx + 1, links);
  });
  return links;
}

/** @param {string[]} [paths] @returns {string[]} human-readable failure descriptions */
export function checkHeadingAnchors(paths = defaultMarkdownPaths()) {
  const slugsByFile = new Map();
  for (const p of paths) {
    slugsByFile.set(resolve(p), headingSlugs(readFileSync(p, 'utf8')));
  }

  const failures = [];
  for (const p of paths) {
    const abs = resolve(p);
    const content = readFileSync(p, 'utf8');
    for (const { line, target } of extractFragmentLinks(content)) {
      const hashIdx = target.indexOf('#');
      const filePart = target.slice(0, hashIdx);
      const anchor = target.slice(hashIdx + 1);
      const targetAbs = filePart === '' ? abs : resolve(dirname(abs), filePart);
      const slugs = slugsByFile.get(targetAbs);
      if (!slugs) continue;
      if (!slugs.has(anchor)) {
        failures.push(
          `${p}:${line} -> ${target} (no heading slug "${anchor}" in ${relative('.', targetAbs)})`
        );
      }
    }
  }
  return failures;
}

function main() {
  const paths = defaultMarkdownPaths();
  const shell = process.platform === 'win32';
  const linkResult = spawnSync(
    'npx',
    ['--yes', 'markdown-link-check@3', '-c', '.markdown-link-check.json', ...paths],
    { stdio: 'inherit', shell }
  );
  const linkExit = linkResult.status === null ? 1 : linkResult.status;

  const anchorFailures = checkHeadingAnchors(paths);
  if (anchorFailures.length > 0) {
    error(`\nERROR: ${anchorFailures.length} dead heading anchor(s) found!`);
    for (const f of anchorFailures) error(`  [✖] ${f}`);
  } else {
    log('\nAll heading anchors resolve.');
  }

  process.exit(linkExit !== 0 ? linkExit : anchorFailures.length > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  main();
}
