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
import create_seed from './create_seed';

describe('create_seed command', () => {
  const testDataDir = wsPath('//src/test/data');

  let tempDir: string;
  let exitMock: jest.SpyInstance;
  let errorMock: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create_seed-'));
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    errorMock = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
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

        await create_seed.parseAsync([
          'node',
          'create_seed',
          studiesDir,
          '--output_seed_file',
          outputFile,
          '--mock_serial_number',
          '1',
          '--output_serial_number_file',
          serialNumberPath,
        ]);

        const output = await fs.readFile(outputFile);
        const expectedOutput = await fs.readFile(
          path.join(testCaseDir, 'expected_seed.bin'),
        );
        expect(output).toEqual(expectedOutput);

        const outputSerialNumber = await fs.readFile(serialNumberPath, 'utf-8');
        expect(outputSerialNumber).toEqual('1');
        expect(VariationsSeed.fromBinary(output).version).toEqual('1');
      },
    );
  });

  test('set seed version', async () => {
    const testCaseDir = path.join(testDataDir, 'set_seed_version');
    const studiesDir = path.join(testCaseDir, 'studies');
    const outputFile = path.join(tempDir, 'output.bin');
    const serialNumberPath = path.join(tempDir, 'serial_number.txt');

    await create_seed.parseAsync([
      'node',
      'create_seed',
      studiesDir,
      '--output_seed_file',
      outputFile,
      '--version',
      'test version value',
      '--mock_serial_number',
      '1',
      '--output_serial_number_file',
      serialNumberPath,
    ]);

    const output = await fs.readFile(outputFile);
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
          create_seed.parseAsync([
            'node',
            'create_seed',
            studiesDir,
            '--output_seed_file',
            outputFile,
            '--mock_serial_number',
            '1',
            '--output_serial_number_file',
            serialNumberPath,
          ]),
        ).rejects.toThrowError('process.exit(1)');
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
          create_seed.parseAsync([
            'node',
            'create_seed',
            studiesDir,
            '--output_seed_file',
            outputFile,
            '--mock_serial_number',
            '1',
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
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');

        await expect(
          create_seed.parseAsync([
            'node',
            'create_seed',
            studiesDir,
            '--output_seed_file',
            outputFile,
          ]),
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
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const outputFile = path.join(tempDir, 'output.bin');

        await expect(
          create_seed.parseAsync([
            'node',
            'create_seed',
            path.join(testCaseDir, 'studies'),
            '--output_seed_file',
            outputFile,
          ]),
        ).rejects.toThrowError('process.exit(1)');
      },
    );
  });
});
