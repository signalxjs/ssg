#!/usr/bin/env node

/**
 * SignalX SSG - Pre-publish pack smoke test
 *
 * Catches packaging bugs that lint/typecheck/test miss:
 *   - missing files in `files` array
 *   - broken `exports` map
 *   - unresolved `workspace:^` ranges
 *   - dist/ produced by stale builds
 *
 * What it does:
 *   1. Build the workspace (delegates to `pnpm run build`).
 *   2. `pnpm pack` each publishable package into a temp dir.
 *   3. Spin up a minimal scratch project that imports the packed tarballs and
 *      runs `@sigx/ssg`'s public entry points (config + vite plugin) under tsx.
 *
 * Usage:
 *   node scripts/verify-pack.js
 *
 * No flags. Exits non-zero on any failure.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PACKAGES = ['packages/ssg', 'packages/ssg-theme-daisyui'];

/**
 * The scratch app's non-tarball deps must match what the PACKED manifests
 * peer-require, and those come from the `catalog:` block — `pnpm pack` rewrites
 * `catalog:` to the concrete range on publish. Hardcoding them here meant the
 * sandbox pinned one version while the tarball demanded another, and npm failed
 * the install with ERESOLVE on every core rollout (`peer @sigx/router@^0.11.0`
 * from the packed `@sigx/ssg` against `^0.10.0` in the sandbox root). Reading
 * the catalog keeps the one source of truth actually singular.
 */
function readCatalog() {
    const ws = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
    const entry = /^\s+(["']?)([@a-zA-Z0-9._/-]+)\1\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/;
    const out = {};
    let inCatalog = false;
    for (const line of ws.split('\n')) {
        if (/^(catalog|catalogs)\s*:/.test(line)) { inCatalog = true; continue; }
        // A column-0 comment is valid YAML mid-mapping and does not end the block.
        if (inCatalog && line.trim() !== '' && !/^\s*#/.test(line) && /^\S/.test(line)) inCatalog = false;
        if (!inCatalog) continue;
        const m = entry.exec(line);
        if (m) out[m[2]] = m[3] ?? m[4] ?? m[5];
    }
    return out;
}

/** Look a spec up in the catalog, failing loudly rather than pinning a stale default. */
function fromCatalog(catalog, name) {
    const spec = catalog[name];
    if (!spec) {
        throw new Error(
            `verify-pack: "${name}" is not in the pnpm-workspace.yaml catalog, so the ` +
                `scratch app cannot pin the version the packed tarball peer-requires.`
        );
    }
    return spec;
}

const sandbox = join(tmpdir(), `sigx-ssg-verify-pack-${Date.now()}`);
const tarballDir = join(sandbox, 'tarballs');
const appDir = join(sandbox, 'app');

function run(cmd, opts = {}) {
    console.log(`$ ${cmd}${opts.cwd ? `  (in ${opts.cwd})` : ''}`);
    execSync(cmd, { stdio: 'inherit', ...opts });
}

function step(label) {
    console.log(`\n▶  ${label}`);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function packPackage(pkgPath) {
    const pkgFullPath = join(rootDir, pkgPath);
    const pkgJson = readJson(join(pkgFullPath, 'package.json'));
    run('pnpm pack --pack-destination ' + JSON.stringify(tarballDir), { cwd: pkgFullPath });
    const tarballs = readdirSync(tarballDir).filter((f) => f.endsWith('.tgz'));
    const safeName = pkgJson.name.replace('@', '').replace('/', '-');
    const match = tarballs.find((f) => f.startsWith(safeName));
    if (!match) {
        throw new Error(`Could not find tarball for ${pkgJson.name} in ${tarballDir}`);
    }
    return { name: pkgJson.name, version: pkgJson.version, tarball: join(tarballDir, match) };
}

function main() {
    step(`Sandbox: ${sandbox}`);
    mkdirSync(tarballDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });

    step('Build all packages');
    run('pnpm run build', { cwd: rootDir });

    step('Pack each publishable package');
    const packed = PACKAGES.map(packPackage);
    for (const p of packed) {
        console.log(`   📦 ${p.name}@${p.version}  →  ${p.tarball}`);
    }

    step('Create scratch app');
    const rootPkg = readJson(join(rootDir, 'package.json'));
    const catalog = readCatalog();
    const deps = Object.fromEntries(
        packed.map((p) => [p.name, `file:${p.tarball.replace(/\\/g, '/')}`])
    );
    const appPkg = {
        name: 'sigx-ssg-pack-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: { smoke: 'tsx smoke.ts' },
        dependencies: {
            ...deps,
            '@sigx/router': fromCatalog(catalog, '@sigx/router'),
            '@sigx/server-renderer': fromCatalog(catalog, '@sigx/server-renderer'),
            sigx: fromCatalog(catalog, 'sigx'),
            vite: rootPkg.devDependencies.vite,
        },
        devDependencies: {
            tsx: '^4.19.0',
            typescript: rootPkg.devDependencies.typescript,
        },
    };
    writeFileSync(join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2));

    writeFileSync(
        join(appDir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ['*.ts'],
            },
            null,
            2
        )
    );

    // Exercise the published public entry points: main config helper, vite plugin, and the theme.
    writeFileSync(
        join(appDir, 'smoke.ts'),
        [
            "import * as ssg from '@sigx/ssg';",
            "import ssgPlugin from '@sigx/ssg/vite';",
            "import * as theme from '@sigx/ssg-theme-daisyui';",
            '',
            "if (typeof ssgPlugin !== 'function') throw new Error('@sigx/ssg/vite did not export a plugin function');",
            "const plugin = ssgPlugin({ root: process.cwd() });",
            "if (!plugin || (Array.isArray(plugin) ? plugin.length === 0 : !plugin.name)) {",
            "  throw new Error('@sigx/ssg/vite plugin shape unexpected');",
            "}",
            "console.log('ssg keys:', Object.keys(ssg).sort().join(', '));",
            "console.log('theme keys:', Object.keys(theme).sort().join(', '));",
            "console.log('OK');",
            '',
        ].join('\n')
    );

    step('Install scratch app (npm — to avoid pnpm workspace hoisting interference)');
    run('npm install --no-audit --no-fund --loglevel=error', { cwd: appDir });

    step('Run scratch app smoke test');
    run('npm run smoke', { cwd: appDir });

    step('✅ Pack smoke test passed');
}

try {
    main();
} catch (err) {
    console.error('\n❌ Pack smoke test failed:', err.message);
    console.error(`   Sandbox preserved for inspection: ${sandbox}`);
    process.exitCode = 1;
    process.exit(1);
}

// Best-effort cleanup on success only — leave the sandbox on failure for debugging.
try {
    rmSync(sandbox, { recursive: true, force: true });
} catch {
    // ignore
}
