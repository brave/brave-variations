// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs_sync from 'fs';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import create_seed from './create_seed';

describe('create_seed command', () => {
  const testDataDir = wsPath('//src/test/data');

  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create_seed-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
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
          outputFile,
          '--mock_serial_number',
          '1',
          '--serial_number_path',
          serialNumberPath,
        ]);

        const output = await fs.readFile(outputFile);
        const expectedOutput = await fs.readFile(
          path.join(testCaseDir, 'expected_seed.bin'),
        );
        expect(output).toEqual(expectedOutput);

        const outputSerialNumber = await fs.readFile(serialNumberPath, 'utf-8');
        expect(outputSerialNumber).toEqual('1');
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
          create_seed.parseAsync([
            'node',
            'create_seed',
            studiesDir,
            outputFile,
            '--mock_serial_number',
            '1',
            '--serial_number_path',
            serialNumberPath,
          ]),
        ).rejects.toThrow();
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

        const expectedError = (
          await fs.readFile(
            path.join(testCaseDir, 'expected_error.txt'),
            'utf-8',
          )
        ).trim();

        await expect(
          create_seed.parseAsync([
            'node',
            'create_seed',
            studiesDir,
            outputFile,
            '--mock_serial_number',
            '1',
            '--serial_number_path',
            serialNumberPath,
          ]),
        ).rejects.toThrow(new RegExp(expectedError));
      },
    );
  });
});
