# Seed tools

`pnpm seed_tools <tool> <parameters>`

## Tools

### `compare_seeds`

Compares two seed binary files and displays a human-readable diff. Used for safe
migration from the python seed generator to the typescript seed generator.

### `create`

Generates a `seed.bin` file from study files.

### `lint`

Lints study files.

### `split_seed_json`

Splits a legacy `seed.json` file into individual study files.

## Tools help

Run to get available arguments and options:

```bash
pnpm seed_tools <tool> --help
```
