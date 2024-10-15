// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs_sync from 'fs';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import create from './create';
import lint from './lint';

describe('lint command', () => {
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

  describe('lint valid studies', () => {
    const unformattedStudiesDir = path.join(testDataDir, 'valid_seeds');

    it.each(fs_sync.readdirSync(unformattedStudiesDir))(
      'correctly lints %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');

        await lint().parseAsync(['node', 'lint', studiesDir]);

        expect(errorMock).toHaveBeenCalledTimes(0);
      },
    );
  });

  describe('lint unformatted studies', () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    it.each(fs_sync.readdirSync(unformattedStudiesDir))(
      'correctly lints %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');

        await expect(
          lint().parseAsync(['node', 'lint', studiesDir]),
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

  describe('fix unformatted studies', () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    it.each(fs_sync.readdirSync(unformattedStudiesDir))(
      'correctly fixes %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const tempStudiesDir = path.join(tempDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');

        // copy the unformatted studies to a temp dir
        await fs.mkdir(tempStudiesDir);
        await fs.copyFile(
          path.join(studiesDir, 'TestStudy.json'),
          path.join(tempStudiesDir, 'TestStudy.json'),
        );

        // lint should fail.
        await expect(
          lint().parseAsync(['node', 'lint', tempStudiesDir]),
        ).rejects.toThrowError('process.exit(1)');

        // Fix studies.
        await lint().parseAsync(['node', 'lint', tempStudiesDir, '--fix']);

        // lint should not fail.
        await lint().parseAsync(['node', 'lint', tempStudiesDir]);

        // Seed creation should not fail.
        await create().parseAsync([
          'node',
          'create',
          tempStudiesDir,
          outputFile,
        ]);
      },
    );
  });
});
