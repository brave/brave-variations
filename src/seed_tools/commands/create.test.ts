// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock, test } from 'node:test';

import * as fs_sync from 'fs';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VariationsSeed } from 'src/proto/generated/variations_seed';
import { wsPath } from '../../base/path_utils';
import create from './create';

// Helper function to compare protobuf with expected json.
const compareProtobuf = (actual: Uint8Array, expectedFilename: string) => {
  let expectedJson = '{}';
  if (fs_sync.existsSync(expectedFilename)) {
    expectedJson = fs_sync.readFileSync(expectedFilename, 'utf-8');
  }
  const expected = VariationsSeed.fromJsonString(expectedJson, {
    ignoreUnknownFields: false,
  });
  const actualObj = VariationsSeed.fromBinary(actual);
  try {
    assert.deepStrictEqual(actualObj, expected);
  } catch (error) {
    const failedFilename = expectedFilename + '.failed';
    fs_sync.writeFileSync(
      failedFilename,
      VariationsSeed.toJsonString(actualObj, {
        useProtoFieldName: true,
        prettySpaces: 2,
      }) + '\n',
    );
    throw error;
  }
};

describe('create command', () => {
  const testDataDir = wsPath('//src/test/data');

  let tempDir: string;
  let errorOutput: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create_seed-'));
    mock.method(process, 'exit', (code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    errorOutput = '';
    mock.method(console, 'error', (...args: any[]) => {
      errorOutput += args.join(' ');
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    mock.restoreAll();
  });

  describe('valid seeds', async () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');

    for (const testCase of fs_sync.readdirSync(validSeedsDir)) {
      await it(`correctly creates ${testCase}`, async () => {
        const testCaseDir = path.join(validSeedsDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await create().parseAsync([
          'node',
          'create',
          studiesDir,
          outputFile,
          '--mock_serial_number',
          '1',
          '--output_serial_number_file',
          serialNumberPath,
        ]);

        const output = fs_sync.readFileSync(outputFile);
        compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

        const outputSerialNumber = fs_sync.readFileSync(
          serialNumberPath,
          'utf-8',
        );
        assert.strictEqual(outputSerialNumber, '1');
        assert.strictEqual(VariationsSeed.fromBinary(output).version, '1');
      });
    }
  });

  describe('perf seeds', async () => {
    const validSeedsDir = path.join(testDataDir, 'perf_seeds');
    const runTest = async (testCase: string, revision?: string) => {
      const testCaseDir = path.join(validSeedsDir, testCase);
      const studiesDir = path.join(testCaseDir, 'studies');
      const outputFile = path.join(tempDir, 'output.bin');

      const args = [
        'node',
        'create',
        studiesDir,
        outputFile,
        '--perf_mode',
        '--mock_serial_number',
        '1',
      ];
      args.push(...(revision ? ['--revision', revision] : []));
      await create().parseAsync(args);

      const output = fs_sync.readFileSync(outputFile);
      compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

      assert.strictEqual(VariationsSeed.fromBinary(output).version, '1');
    };

    await it('test1', async () => await runTest('test1', undefined));

    // Check creating seed using git history.
    await it('test1_git_revision', async () => await runTest('test1', 'HEAD'));

    // Check creating seed using git history for legacy seed.json.
    await it('legacy_seed', async () =>
      await runTest('legacy_seed', '3f3eb03e12eb7f37a315f66f735d3decb483a90d'));
  });

  test('set seed version', async () => {
    const testCaseDir = path.join(testDataDir, 'set_seed_version');
    const studiesDir = path.join(testCaseDir, 'studies');
    const outputFile = path.join(tempDir, 'output.bin');
    const serialNumberPath = path.join(tempDir, 'serial_number.txt');

    await create().parseAsync([
      'node',
      'create',
      studiesDir,
      outputFile,
      '--version',
      'test version value',
      '--mock_serial_number',
      '1',
      '--output_serial_number_file',
      serialNumberPath,
    ]);

    const output = fs_sync.readFileSync(outputFile);
    compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

    // Check the binary output is the same as the expected output.
    const expectedOutput = fs_sync.readFileSync(
      path.join(testCaseDir, 'expected_seed.bin'),
    );
    assert.deepStrictEqual(output, expectedOutput);

    const outputSerialNumber = fs_sync.readFileSync(serialNumberPath, 'utf-8');
    assert.strictEqual(outputSerialNumber, '1');
    assert.strictEqual(
      VariationsSeed.fromBinary(output).version,
      'test version value',
    );
  });

  describe('serial number is equal in the seed and in the generated file', async () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    for (const testCase of fs_sync.readdirSync(validSeedsDir)) {
      await it(`correctly creates ${testCase}`, async () => {
        const testCaseDir = path.join(validSeedsDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await create().parseAsync([
          'node',
          'create',
          studiesDir,
          outputFile,
          '--output_serial_number_file',
          serialNumberPath,
        ]);

        const output = fs_sync.readFileSync(outputFile);
        const outputSerialNumber = fs_sync.readFileSync(
          serialNumberPath,
          'utf-8',
        );
        assert.notStrictEqual(outputSerialNumber, '1');
        assert.strictEqual(
          VariationsSeed.fromBinary(output).serial_number,
          outputSerialNumber,
        );
      });
    }
  });

  describe('invalid studies', async () => {
    const invalidStudiesDir = path.join(testDataDir, 'invalid_studies');

    for (const testCase of fs_sync.readdirSync(invalidStudiesDir)) {
      await it(`correctly fails ${testCase}`, async () => {
        const testCaseDir = path.join(invalidStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await assert.rejects(
          create().parseAsync([
            'node',
            'create',
            studiesDir,
            outputFile,
            '--output_serial_number_file',
            serialNumberPath,
          ]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected create to fail with exit code 1',
            );
            return true;
          },
        );

        const expectedError = (
          await fs.readFile(
            path.join(testCaseDir, 'expected_errors.txt'),
            'utf-8',
          )
        ).trim();
        assert.ok(
          errorOutput.includes(expectedError),
          `Expected error output to contain: ${expectedError}, but got: ${errorOutput}`,
        );
      });
    }
  });

  describe('invalid seeds', async () => {
    const invalidSeedsDir = path.join(testDataDir, 'invalid_seeds');
    for (const testCase of fs_sync.readdirSync(invalidSeedsDir)) {
      await it(`correctly fails ${testCase}`, async () => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await assert.rejects(
          create().parseAsync([
            'node',
            'create',
            studiesDir,
            outputFile,
            '--output_serial_number_file',
            serialNumberPath,
          ]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected create to fail with exit code 1',
            );
            return true;
          },
        );

        const expectedError = (
          await fs.readFile(
            path.join(testCaseDir, 'expected_error.txt'),
            'utf-8',
          )
        ).trim();
        assert.ok(errorOutput.includes(expectedError));
      });
    }
  });

  describe('unformatted studies', async () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');
    for (const testCase of fs_sync.readdirSync(unformattedStudiesDir)) {
      await it(`correctly lints ${testCase}`, async () => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');

        await assert.rejects(
          create().parseAsync(['node', 'create', studiesDir, outputFile]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected create to fail with exit code 1',
            );
            return true;
          },
        );
        const expectedOutput = await fs.readFile(
          path.join(testCaseDir, 'expected_output.txt'),
          'utf-8',
        );
        assert.ok(
          errorOutput.includes(expectedOutput),
          `Expected error output to contain: ${expectedOutput}, but got: ${errorOutput}`,
        );
      });
    }
  });

  describe('studies should be valid in invalid_seed test dir', async () => {
    const invalidSeedsDir = path.join(testDataDir, 'invalid_seeds');

    for (const testCase of fs_sync.readdirSync(invalidSeedsDir)) {
      await it(`correctly lints ${testCase}`, async () => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const outputFile = path.join(tempDir, 'output.bin');

        await assert.rejects(
          create().parseAsync([
            'node',
            'create',
            path.join(testCaseDir, 'studies'),
            outputFile,
          ]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected create to fail with exit code 1',
            );
            return true;
          },
        );
      });
    }
  });
});
