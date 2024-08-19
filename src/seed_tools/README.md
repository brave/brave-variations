# Seed tools

`npm run seed_tools -- <tool> <parameters>`

## Tools

### `check_study`

Validates study files for both logic and format errors. Called automatically
during `lint` for `studies/**/*.json` files.

##### Syntax

```bash
npm run seed_tools -- check_study <study_files...> [--fix]
```

##### Arguments

- `<study_files...>`: One or more study files that you want to check.

##### Options

- `--fix`: Fix format errors in-place.

### `create_seed`

Generates a `seed.bin` file from study files.

##### Syntax

```bash
npm run seed_tools -- create_seed <studies_dir> <output_file> [--mock_serial_number <value>] [--serial_number_path <path>]
```

##### Arguments

- `<studies_dir>`: The directory containing the study files.
- `<output_file>`: The output file for the generated seed.

##### Options

- `--mock_serial_number <value>`: Mock a serial number. If not provided, a
  random number is used.
- `--serial_number_path <path>`: The file path to write the serial number to.

### `compare_seeds`

Compares two seed binary files and displays a human-readable diff. Used for safe
migration from the python seed generator to the typescript seed generator.

##### Syntax

```bash
npm run seed_tools -- compare_seeds <seed1_file> <seed2_file>
```

##### Arguments

- `<seed1_file>`: The first seed binary file to compare.
- `<seed2_file>`: The second seed binary file to compare.

### `split_seed_json`

Splits a legacy `seed.json` file into individual study files.

##### Syntax

```bash
npm run seed_tools -- split_seed_json <seed_json_path> <output_dir>
```

##### Arguments

- `<seed_json_path>`: The path to the `seed.json` file to be split.
- `<output_dir>`: The directory where the individual study files will be
  outputted.

### `validate_seed_pb`

Validates a seed protobuf.

##### Syntax

```bash
npm run seed_tools -- validate_seed_pb <seed_bin>
```

##### Arguments

- `<seed_bin>`: The path to the binary-serialized `seed` protobuf.
