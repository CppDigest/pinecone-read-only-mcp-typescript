import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  checkHeadingAnchors,
  extractFragmentLinks,
  headingSlugs,
  slugify,
} from './docs-link-check.mjs';

describe('slugify', () => {
  it('preserves inline code and strips version punctuation', () => {
    expect(slugify('0.5.0: `list_sources` response shape')).toBe('050-list_sources-response-shape');
  });

  it('slugifies em-dash headings', () => {
    expect(slugify('AC 1 — npm registry version and publish time')).toBe(
      'ac-1--npm-registry-version-and-publish-time'
    );
  });

  it('slugifies colon-separated deprecation heading', () => {
    expect(slugify('Active deprecations: legacy module facades')).toBe(
      'active-deprecations-legacy-module-facades'
    );
  });
});

describe('headingSlugs', () => {
  it('deduplicates repeated headings with numeric suffixes', () => {
    const content = '# Title\n## Section\n## Section\n';
    expect(headingSlugs(content)).toEqual(new Set(['title', 'section', 'section-1']));
  });
});

describe('extractFragmentLinks', () => {
  it('collects relative fragment links outside inline code', () => {
    const content = 'See [docs](./other.md#anchor) for details.\n';
    expect(extractFragmentLinks(content)).toEqual([{ line: 1, target: './other.md#anchor' }]);
  });

  it('ignores fragment links inside inline code spans', () => {
    const content = 'Example `[foo](#bar)` in prose.\n';
    expect(extractFragmentLinks(content)).toEqual([]);
  });
});

describe('checkHeadingAnchors', () => {
  it('reports missing anchors and accepts valid ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'docs-link-check-'));
    const source = join(dir, 'source.md');
    const target = join(dir, 'target.md');
    writeFileSync(source, '[link](./target.md#good)\n[bad](./target.md#missing)\n');
    writeFileSync(target, '## Good\n');

    const failures = checkHeadingAnchors([source, target]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('#missing');
    expect(failures[0]).not.toContain('#good');
  });
});
