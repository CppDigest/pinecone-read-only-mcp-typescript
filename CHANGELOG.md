# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `list_namespaces` tool: discovers all namespaces with record counts and sampled metadata fields
- `namespace_router` tool: ranks namespaces by relevance to a natural-language query
- `suggest_query_params` tool: mandatory flow gate that recommends fields and tool variant before queries
- `count` tool: counts unique documents matching a query, with `truncated` flag when results exceed `COUNT_TOP_K`
- `query_fast` tool: lightweight chunk-level search with minimal field set
- `query_detailed` tool: chunk-level search with optional semantic reranking
- `query` tool: unified query entry-point supporting `query_fast` and `query_detailed` modes
- `guided_query` tool: single-call orchestrator that runs routing → suggestion → execution, returning a `decision_trace`
- `generate_urls` tool: synthesizes URLs for records whose metadata lacks a `url` field
- `query_documents` tool: reassembles full documents from chunks grouped by document identifier
- Centralized structured logger (`src/logger.ts`) with level-gated stderr output and stack-trace capture
- Dockerfile for containerised deployment
- `About.md` project documentation covering architecture, tools, and operating principles

### Changed

- Modularised server into focused files under `src/server/` (tools, caches, formatters, suggestion flow)
- CI workflow updated: multi-node matrix (`18.x`, `20.x`, `22.x`), separate quality job with `continue-on-error`
- Replaced all `console.error` calls in `pinecone-client.ts` with typed `logInfo` / `logDebug` / `logError`

### Fixed

- Timestamp-based metadata filter now correctly handles numeric epoch values

### Security

- N/A

## [0.1.1] - 2026-01-27

### Changed

- Enhanced TypeScript strict mode with additional compiler checks:
  - Added `noUncheckedIndexedAccess` for safer array/object access
  - Added `noImplicitOverride` to require explicit override keywords
  - Added `noPropertyAccessFromIndexSignature` to enforce bracket notation for index signatures
- Updated all code to use bracket notation for environment variables and dynamic property access
- Simplified build script to use standard `tsc` command

### Fixed

- Fixed build script that was suppressing TypeScript compilation errors with `|| exit 0`
- Fixed all type safety issues to comply with stricter TypeScript checks

## [0.1.0] - 2026-01-26

### Added

- Initial release of TypeScript version
- Feature parity with Python version
- Production-ready implementation with:
  - Lazy initialization
  - Connection pooling
  - Error handling
  - Input validation
  - Configurable logging
- CLI interface with multiple options
- Environment variable support
- Full documentation and examples

[Unreleased]: https://github.com/CppDigest/pinecone-read-only-mcp-typescript/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/CppDigest/pinecone-read-only-mcp-typescript/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/CppDigest/pinecone-read-only-mcp-typescript/releases/tag/v0.1.0
