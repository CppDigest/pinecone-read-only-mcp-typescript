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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

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

const paths = ['README.md', 'CHANGELOG.md', ...walkMarkdownFiles('docs')];

/**
 * ASCII + common Unicode punctuation stripped by GitHub's heading slugger
 * (verified against `github-slugger@2` output for every heading in this repo's
 * docs). Deliberately excludes `-` and `_`, which GitHub preserves.
 */
const SLUG_STRIP_RE = /[!-,./:-@[-^`{-~\u00A1-\u00BF\u00D7\u00F7\u2000-\u206F\u2190-\u21FF]/g;

/** @param {string} text @returns {string} */
function stripInlineMarkdown(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]*)`/g, (_m, inner) => {
    codeSpans.push(inner);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1');
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => codeSpans[Number(i)]);
}

/** @param {string} text @returns {string} */
function slugify(text) {
  return stripInlineMarkdown(text).toLowerCase().replace(SLUG_STRIP_RE, '').replace(/ /g, '-');
}

/** @param {string} content @returns {Set<string>} */
function headingSlugs(content) {
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

/** @param {string} content @returns {Array<{line: number, target: string}>} */
function extractFragmentLinks(content) {
  const links = [];
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  let inCodeBlock = false;
  content.split(/\r?\n/).forEach((line, idx) => {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      const target = m[1].trim();
      if (/^https?:\/\//.test(target) || target.startsWith('mailto:')) continue;
      if (!target.includes('#')) continue;
      links.push({ line: idx + 1, target });
    }
  });
  return links;
}

/** @returns {string[]} human-readable failure descriptions */
function checkHeadingAnchors() {
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
      if (!slugs) continue; // target file outside the checked set (e.g. not markdown); skip
      if (!slugs.has(anchor)) {
        failures.push(`${p}:${line} -> ${target} (no heading slug "${anchor}" in ${relative('.', targetAbs)})`);
      }
    }
  }
  return failures;
}

const shell = process.platform === 'win32';
const linkResult = spawnSync(
  'npx',
  ['--yes', 'markdown-link-check@3', '-c', '.markdown-link-check.json', ...paths],
  { stdio: 'inherit', shell }
);
const linkExit = linkResult.status === null ? 1 : linkResult.status;

const anchorFailures = checkHeadingAnchors();
if (anchorFailures.length > 0) {
  console.error(`\nERROR: ${anchorFailures.length} dead heading anchor(s) found!`);
  for (const f of anchorFailures) console.error(`  [✖] ${f}`);
} else {
  console.log('\nAll heading anchors resolve.');
}

process.exit(linkExit !== 0 ? linkExit : anchorFailures.length > 0 ? 1 : 0);
