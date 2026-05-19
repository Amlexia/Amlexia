# Publishing Amlexia SDKs

## npm (`@amlexiahq` org)

Prerequisites: npm token with publish access to `@amlexiahq` (bypass 2FA for CI tokens).

```bash
pnpm install
pnpm --filter @amlexiahq/shared build
cd packages/shared && npm publish --access public

pnpm --filter @amlexiahq/node build
cd sdks/node && pnpm publish --access public --no-git-checks
```

Bump `version` in `packages/shared/package.json` and `sdks/node/package.json` before each release.

## PyPI (`amlexia`)

Prerequisites: API token in `~/.pypirc` (`username = __token__`).

```bash
cd sdks/python
pip wheel . --no-deps -w dist
python -m twine check dist/*
python -m twine upload dist/*
```

Bump `version` in `pyproject.toml` for each release.

## Verify

```bash
npm view @amlexiahq/node version
pip index versions amlexia
```
