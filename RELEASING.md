# Releasing

Publishing happens **only** from GitHub Actions via npm Trusted Publishing (OIDC). No `NPM_TOKEN` is stored.

## Pre-release checklist

- [ ] `pnpm install`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass on `main`.
- [ ] `pnpm publish:dry` succeeds.
- [ ] Per-package `CHANGELOG.md` entries added (`packages/ssg/`, `packages/ssg-theme-daisyui/`).
- [ ] Each package's `repository`, `homepage`, and `bugs` fields point at `signalxjs/ssg`.

## Cutting a release

```bash
pnpm version:patch          # or minor / major / explicit
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

The release workflow publishes every package directly to `@latest` (with provenance) and publishes the GitHub Release.

## Publish order

The publish script publishes packages in dependency order:

1. `@sigx/ssg`
2. `@sigx/ssg-theme-daisyui`

## Onboarding a new package to npm Trusted Publishing

For each package the **first publish** has to be done manually with an authenticated npm account, then on https://www.npmjs.com/package/<name>/access:

1. Settings → Trusted Publishers → Add a Trusted Publisher.
2. Provider: GitHub Actions.
3. Repository owner: `signalxjs`. Repository: `ssg`. Workflow filename: `release.yml`. Environment: `npm-publish`.

Subsequent publishes happen automatically via OIDC. Tarballs carry npm provenance attestation and the verified publisher badge.

## Dist-tag strategy

Releases publish **directly to `@latest`** — there is no beta/soak stage for now, since we ship fast and have no beta channel. The CI gate (lint, typecheck, build, test, verify pack) plus a post-release smoke test against `signalxjs/signalxjs.github.io` is the safety net. If a release turns out bad, roll back by pointing `@latest` at the previous version:

```bash
npm dist-tag add <pkg>@<previous-version> latest
```

After the workflow finishes:

1. Smoke-test against `signalxjs/signalxjs.github.io` checked out locally with the new versions installed.
2. Roll the per-package `CHANGELOG.md`s (`[Unreleased]` → the new version).

The publish script still supports `--tag beta` (`pnpm publish:beta`) if a release ever needs a pre-release channel. Pre-release identifiers (`0.1.0-rc.1`) are reserved for breaking changes that deserve broader review.
