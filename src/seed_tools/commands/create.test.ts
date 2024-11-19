// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

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
    expect(actualObj).toEqual(expected);
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
  let logMock: jest.SpyInstance;
  let exitMock: jest.SpyInstance;
  let errorMock: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create_seed-'));
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    logMock = jest.spyOn(console, 'log').mockImplementation();
    errorMock = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    logMock.mockRestore();
    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  describe('valid seeds', () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    it.each(fs_sync.readdirSync(validSeedsDir))(
      'correctly creates %s',
      async (testCase) => {
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

        const output = await fs.readFile(outputFile);
        compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

        const outputSerialNumber = await fs.readFile(serialNumberPath, 'utf-8');
        expect(outputSerialNumber).toEqual('1');
        expect(VariationsSeed.fromBinary(output).version).toEqual('1');
      },
    );
  });

  describe('perf seeds', () => {
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

      const output = await fs.readFile(outputFile);
      compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

      expect(VariationsSeed.fromBinary(output).version).toEqual('1');
    };

    it('test1', () => runTest('test1', undefined));

    // Check creating seed using git history.
    it('test1_git_revision', () => runTest('test1', 'HEAD'));

    // Check creating seed using git history for legacy seed.json.
    it('legacy_seed', () => runTest('legacy_seed', '3f3eb03e'));
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

    const output = await fs.readFile(outputFile);
    compareProtobuf(output, path.join(testCaseDir, 'expected_seed.json'));

    // Check the binary output is the same as the expected output.
    const expectedOutput = await fs.readFile(
      path.join(testCaseDir, 'expected_seed.bin'),
    );
    expect(output).toEqual(expectedOutput);

    const outputSerialNumber = await fs.readFile(serialNumberPath, 'utf-8');
    expect(outputSerialNumber).toEqual('1');
    expect(VariationsSeed.fromBinary(output).version).toEqual(
      'test version value',
    );
  });

  describe('serial number is equal in the seed and in the generated file', () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    it.each(fs_sync.readdirSync(validSeedsDir))(
      'correctly creates %s',
      async (testCase) => {
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

        const output = await fs.readFile(outputFile);
        const outputSerialNumber = await fs.readFile(serialNumberPath, 'utf-8');
        expect(outputSerialNumber).not.toEqual('1');
        expect(VariationsSeed.fromBinary(output).serial_number).toEqual(
          outputSerialNumber,
        );
      },
    );
  });

  describe('invalid studies', () => {
    const invalidStudiesDir = path.join(testDataDir, 'invalid_studies');
    it.each(fs_sync.readdirSync(invalidStudiesDir))(
      'correctly fails %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await expect(
          create().parseAsync([
            'node',
            'create',
            studiesDir,
            outputFile,
            '--output_serial_number_file',
            serialNumberPath,
          ]),
        ).rejects.toThrowError('process.exit(1)');

        const expectedError = (
          await fs.readFile(
            path.join(testCaseDir, 'expected_errors.txt'),
            'utf-8',
          )
        ).trim();
        expect(errorMock).toHaveBeenCalledWith(
          expect.stringContaining(expectedError),
        );
      },
    );
  });

  describe('invalid seeds', () => {
    const invalidSeedsDir = path.join(testDataDir, 'invalid_seeds');
    it.each(fs_sync.readdirSync(invalidSeedsDir))(
      'correctly fails %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');
        const serialNumberPath = path.join(tempDir, 'serial_number.txt');

        await expect(
          create().parseAsync([
            'node',
            'create',
            studiesDir,
            outputFile,
            '--output_serial_number_file',
            serialNumberPath,
          ]),
        ).rejects.toThrowError('process.exit(1)');

        const expectedError = (
          await fs.readFile(
            path.join(testCaseDir, 'expected_error.txt'),
            'utf-8',
          )
        ).trim();
        expect(errorMock).toHaveBeenCalledWith(
          expect.stringContaining(expectedError),
        );
      },
    );
  });

  describe('unformatted studies', () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    it.each(fs_sync.readdirSync(unformattedStudiesDir))(
      'correctly lints %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');

        await expect(
          create().parseAsync(['node', 'create', studiesDir, outputFile]),
        ).rejects.toThrowError('process.exit(1)');

        const expectedOutput = await fs.readFile(
          path.join(testCaseDir, 'expected_output.txt'),
          'utf-8',
        );
        expect(errorMock).toHaveBeenCalledWith(
          expect.stringContaining(expectedOutput),
        );
      },
    );
  });

  describe('studies should be valid in invalid_seed test dir', () => {
    const invalidSeedsDir = path.join(testDataDir, 'invalid_seeds');

    it.each(fs_sync.readdirSync(invalidSeedsDir))(
      'correctly lints %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const outputFile = path.join(tempDir, 'output.bin');

        await expect(
          create().parseAsync([
            'node',
            'create',
            path.join(testCaseDir, 'studies'),
            outputFile,
          ]),
        ).rejects.toThrowError('process.exit(1)');
      },
    );
  });
});
