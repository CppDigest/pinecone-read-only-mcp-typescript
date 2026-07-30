# Production readiness sign-off: `@will-cppa/pinecone-read-only-mcp@0.5.0`

- **Package:** `@will-cppa/pinecone-read-only-mcp`
- **Version:** `0.5.0`
- **Git tag:** `v0.5.0` → `c28e346efafadbfef98891e523d566eebe957dad` (“Updated documents for new release (#236)”)
- **Recorded:** 2026-07-29 (UTC+8 local)
- **Verifier:** Jonathan (@jonathanMLDev), assignee for week 5 verification task
- **Scope:** Verification and sign-off only. No product code changes. `ServerContext` decomposition and legacy facade removal remain deferred past July 2026.

## Acceptance criteria evidence

### AC 1 — npm registry version and publish time

| Field                  | Value                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm view … version`   | `0.5.0`                                                                                                 |
| `dist-tags.latest`     | `0.5.0`                                                                                                 |
| `time['0.5.0']` (UTC)  | `2026-07-24T18:41:39.687Z`                                                                              |
| CHANGELOG release date | `2026-07-25` ([CHANGELOG.md](../CHANGELOG.md#050---2026-07-25); calendar date vs UTC publish timestamp) |

Commands used: `npm view @will-cppa/pinecone-read-only-mcp@0.5.0 version gitHead dist-tags time --json`

### AC 2 — `package.json` in tarball vs tagged tree

Repository state for verification: **detached HEAD at `v0.5.0`** (`c28e346`).

Compared packed `package/package.json` from:

1. Local `npm pack` after `npm ci` and `npm run build` on `v0.5.0`
2. Registry `npm pack @will-cppa/pinecone-read-only-mcp@0.5.0`

These fields are **identical** in both tarballs (local pack vs registry pack; no differences in `version`, `files`, `exports`, or `bin`):

- `version`: `0.5.0`
- `files`: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`
- `bin`:

```json
{
  "pinecone-read-only-mcp": "dist/index.js"
}
```

- `exports` (same object in both packed `package/package.json` files):

```json
{
  ".": {
    "types": "./dist/core/index.d.ts",
    "import": "./dist/core/index.js"
  },
  "./alliance": {
    "types": "./dist/alliance/index.d.ts",
    "import": "./dist/alliance/index.js"
  },
  "./package.json": "./package.json"
}
```

`npm pack --dry-run` on the tag reported **208** packaged files; registry pack lists the same paths (no `src/`).

### AC 3 — `dist/` contents and hygiene

- Fresh build on tag: `npm run build` (runs `clean` then `tsc -p tsconfig.build.json`) before pack.
- **No** `*.test.*` (or other test sources) under packed `dist/`.
- **File path set** under `package/` (local vs registry): identical.
- **`dist/**` content:** SHA-256 compared for every file under `dist/` in both tarballs → **0 mismatches** (functional parity of compiled output).
- **Tarball bytes:** full `.tgz` SHA-256 differs between local pack and registry. This is expected from tar entry ordering and gzip stream differences across npm/Node versions (local pack used Node v24.11.1; registry was published from CI on Node 20.x) — **not** content drift: `package.json`, `README.md`, `CHANGELOG.md`, and `LICENSE` are byte-identical between the packed tarball and `git show v0.5.0:<path>` for each file (verified independently of the local `npm pack`, so this holds regardless of the packer's Node version). Registry tarball matches npm `dist.shasum` `f912f88fee5a8499eadac70ddcbf4a25660fbe76`.
- Local verification used **Node v24.11.1**; publish workflow uses **Node 20.x** on Ubuntu ([publish.yml](../.github/workflows/publish.yml)). Despite Node major difference, compiled `dist/` artifacts matched registry byte-for-byte.

### AC 4 — CI, CodeQL, and Publish workflow (release gate)

**npm `gitHead`:** `c28e346efafadbfef98891e523d566eebe957dad` — matches `git rev-parse v0.5.0^{commit}`.

Workflow runs confirmed via the public [GitHub Actions](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/actions) UI on 2026-07-29 (listed as successful; no failure marker on these runs):

| Check                                   | Run                                                                | Link                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **CI** on merge commit `c28e346` (#236) | CI **#480** — “Updated documents for new release (#236)” on `main` | [Run #480](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/actions/runs/30117302054) — Success |
| **CodeQL** on `c28e346`                 | CodeQL **#505** — same commit on `main`                            | [Run #505](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/actions/runs/30117301927) — Success |
| **Publish to npm** for release `v0.5.0` | Publish **#11** — “Release v0.5.0 published” (~3m 25s)             | [Run #11](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/actions/runs/30117705749) — Success  |

Direct run permalinks (not `?query=` filters, which GitHub Actions silently ignores for this UI and would otherwise land on the unfiltered run list).

Release: [v0.5.0](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/releases/tag/v0.5.0) · [Commit checks](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/commit/c28e346efafadbfef98891e523d566eebe957dad/checks)

Publish path aligns with [RELEASING.md](./RELEASING.md): `workflow_call` to `ci.yml`, then `npm publish --provenance --access public`; `prepublishOnly` runs `npm run ci`.

### AC 5 — Artifact alignment (npm vs tag `v0.5.0`)

**Artifact verification is complete.** The published npm package matches repository tag `v0.5.0` (`c28e346`) for the checks in AC 1–4:

- Registry version and `gitHead` align with tag `c28e346`.
- Packed manifest (`version`, `files`, `exports`, `bin`) matches the tagged `package.json` (see AC 2).
- Published `dist/` matches a clean tag build (no test sources in artifact; `dist/**` hash parity with registry).
- CI (#480), CodeQL (#505), and Publish (#11) for the `v0.5.0` release completed successfully per GitHub Actions (see AC 4).

No re-publish or version bump is required based on this verification.

**Registry tarball:** `https://registry.npmjs.org/@will-cppa/pinecone-read-only-mcp/-/pinecone-read-only-mcp-0.5.0.tgz` (`dist.shasum` `f912f88fee5a8499eadac70ddcbf4a25660fbe76`).

**Process sign-off:** Organizational production-readiness sign-off (AC 6) remains **pending** until this documentation PR is approved and merged. Until then, do not treat the release process as fully signed off in-repo.

### AC 6 — Pull request and review

Sign-off is committed under `docs/`. **Requires:**

- [x] PR opened with this file and doc index updates ([README.md](./README.md), [RELEASING.md](./RELEASING.md)) — [PR #242](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/pull/242)
- [ ] ≥ 1 reviewer approval
- [ ] Approver and approval date recorded here after review
- [ ] Merged PR URL recorded here after merge (same as #242 when merged)

## Commands reference (replay on tag)

```powershell
git checkout v0.5.0
npm ci
npm run build
npm pack --dry-run
npm pack
npm pack @will-cppa/pinecone-read-only-mcp@0.5.0

# Extract local and registry tarballs; compare dist/** SHA-256 (expect 0 mismatches)
$localTgz = (Get-ChildItem -Name 'will-cppa-pinecone-read-only-mcp-0.5.0.tgz' | Select-Object -First 1)
$registryTgz = (Get-ChildItem -Name 'will-cppa-pinecone-read-only-mcp-*.tgz' | Where-Object { $_ -ne $localTgz } | Select-Object -First 1)
Remove-Item -Recurse -Force .tmp\verify-local, .tmp\verify-registry -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force .tmp\verify-local, .tmp\verify-registry | Out-Null
tar -xf $localTgz -C .tmp\verify-local
tar -xf $registryTgz -C .tmp\verify-registry
$localDist = '.tmp\verify-local\package\dist'
$registryDist = '.tmp\verify-registry\package\dist'
$localFiles = Get-ChildItem $localDist -Recurse -File | ForEach-Object { $_.FullName.Substring((Resolve-Path $localDist).Path.Length + 1) }
$registryFiles = Get-ChildItem $registryDist -Recurse -File | ForEach-Object { $_.FullName.Substring((Resolve-Path $registryDist).Path.Length + 1) }
Compare-Object $localFiles $registryFiles
$mismatches = @()
foreach ($rel in $localFiles) {
  $lHash = (Get-FileHash -Algorithm SHA256 (Join-Path $localDist $rel)).Hash
  $rHash = (Get-FileHash -Algorithm SHA256 (Join-Path $registryDist $rel)).Hash
  if ($lHash -ne $rHash) { $mismatches += $rel }
}
if ($mismatches.Count -gt 0) { throw "dist hash mismatches: $($mismatches -join ', ')" }
'dist/** SHA-256 parity: 0 mismatches'
```

On Ubuntu (publish workflow host), after extracting both tarballs under `.tmp/verify-local/package/dist` and `.tmp/verify-registry/package/dist`, compare with `sha256sum` on each relative path; expect identical digests for every file under `dist/`.

**Docs link-check:** `npm run docs:link-check` — exit **0** on 2026-07-30 (local, after extending the checker with heading-anchor validation and fixing the anchors it flagged). **Pending:** record the PR #242 `quality` job run URL here once CI finishes on the pushed commit — see the [PR #242 checks tab](https://github.com/cppalliance/pinecone-read-only-mcp-typescript/pull/242/checks).
