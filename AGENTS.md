Top Level layout assumes an Electron + React workspace:

- `electron/` keeps the main process entry (`main.ts`), preload script (`preload.ts`), and shared types. Changes here affect IPC, FFmpeg launches, and application lifecycle.
- `src/` is the renderer bundle powered by Vite; components, hooks, and assets live under `src/components`, `src/hooks`, and `src/assets`, while `App.tsx`, `main.tsx`, and the styling lives at the root of `src`.
- `public/` and `resources/` store static assets that Electron or Vite serve directly.
- Build outputs land in `dist/` (renderer) and `dist-electron/` (main), with the final installers or packages appearing under `release/`.
- Config and tooling files (`package.json`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc.cjs`, `electron-builder.json5`) live at the repo root and drive TypeScript compilation, linting, and packaging.

Build, Test, and Development Commands

- `npm run dev`: launches the Vite dev server for the renderer; use this alongside the Electron process for local UI iterations.
- `npm run build`: runs `tsc`, builds the Vite renderer, and bundles the Electron app with `electron-builder`; use this when preparing releases.
- `npm run preview`: starts `vite preview` so you can sanity-check the renderer output before rerunning the Electron build.
- `npm run lint`: enforces ESLint rules (`@typescript-eslint`, `react-hooks`, `react-refresh`) across `.ts`/`.tsx` files with zero warnings allowed.
- Verification guidance: prefer `npm run lint` (and `tsc` if needed) to confirm correctness; avoid running the full build unless explicitly requested.

Coding Style & Naming Conventions

- Language: TypeScript + React; follow the default Vite/React template patterns (function components, hooks, and `tsconfig` paths).
- Indentation: 2 spaces to match the existing files; keep semicolons and trailing commas consistent with the ESLint standard rules.
- Naming: use PascalCase for React components, camelCase for props and hooks, and uppercase constants for string literals passed over Electron IPC/event names.
- Formatting/linting: ESLint (configured in `.eslintrc.cjs`) is the single source for style; run `npm run lint`, and let editors handle minor autofixes. No additional formatter is enforced, so keep changes minimal and consistent with the surrounding code.

Testing Guidelines

- There is no automated test suite or coverage tooling yet; rely on manual validation in the Electron UI.
- Run `npm run dev`, exercise FFmpeg workflows (select file, cut, merge), and inspect the console/log output for IPC errors.
- Use `npm run lint` before significant changes to catch TypeScript or React contract violations.

Commit & Pull Request Guidelines

- Commit messages follow the existing short/imperative style (e.g., `feat: initial commit`, `phase 1`). Prefer `feat:`/`fix:` prefixes when the change maps to a feature or bug, keep the description focused, and avoid punctuation beyond the colon and core summary.
- Pull requests should include a brief description, highlight any manual steps taken, link relevant issues, and attach UI screenshots when the change touches the renderer. Mention how you validated the change (lint/dev build/run cycle) and call out any remaining TODOs.

Security & Configuration Tips

- Electron runs on Windows only for this project; ensure FFmpeg is installed system-wide and available on `PATH` before starting the app (`electron/main.ts` invokes `ffmpeg -version`).
- When generating merge lists, the backend escapes single quotes for Windows paths; keep that logic untouched unless you understand FFmpeg concat behavior.
