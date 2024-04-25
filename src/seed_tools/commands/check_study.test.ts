// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fss from 'fs';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import check_study from './check_study';

describe('check_study command', () => {
  const testDataDir = wsPath('//src/test/data');

  let tempDir: string;
  let exitMock: jest.SpyInstance;
  let errorMock: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'check_study-'));
    exitMock = jest.spyOn(process, 'exit').mockImplementation();
    errorMock = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    exitMock.mockRestore();
    errorMock.mockRestore();
  });

  describe('valid studies', () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    it.each(fss.readdirSync(validSeedsDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(validSeedsDir, testCase);
        const studyFiles = fss.readdirSync(path.join(testCaseDir, 'studies'));

        for (const study of studyFiles) {
          const studyFile = path.join(testCaseDir, 'studies', study);

          await check_study.parseAsync(['node', 'check_study', studyFile]);
          expect(exitMock).toHaveBeenCalledTimes(0);
          expect(errorMock).toHaveBeenCalledTimes(0);
        }
      },
    );
  });

  describe('invalid studies', () => {
    const invalidStudiesDir = path.join(testDataDir, 'invalid_studies');

    it.each(fss.readdirSync(invalidStudiesDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidStudiesDir, testCase);
        const studyFiles = fss.readdirSync(path.join(testCaseDir, 'studies'));

        for (const study of studyFiles) {
          const studyFile = path.join(testCaseDir, 'studies', study);

          await check_study.parseAsync(['node', 'check_study', studyFile]);
          expect(exitMock).toHaveBeenCalledWith(1);
          expect(exitMock).toHaveBeenCalledTimes(1);
          exitMock.mockClear();

          const expectedOutput = await fs.readFile(
            path.join(testCaseDir, 'expected_errors.txt'),
            'utf-8',
          );
          const expectedOutputLines = expectedOutput.split('\n');
          expect(expectedOutputLines.length).toBeGreaterThan(0);
          for (const line of expectedOutputLines) {
            expect(errorMock).toHaveBeenCalledWith(
              expect.stringContaining(line),
            );
          }
        }
      },
    );
  });

  describe('unformatted studies', () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    it.each(fss.readdirSync(unformattedStudiesDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studyFiles = fss.readdirSync(path.join(testCaseDir, 'studies'));

        for (const study of studyFiles) {
          const studyFile = path.join(testCaseDir, 'studies', study);

          await check_study.parseAsync(['node', 'check_study', studyFile]);
          expect(exitMock).toHaveBeenCalledWith(1);
          expect(exitMock).toHaveBeenCalledTimes(1);
          exitMock.mockClear();

          const expectedOutput = await fs.readFile(
            path.join(testCaseDir, 'expected_output.txt'),
            'utf-8',
          );
          expect(errorMock).toHaveBeenCalledWith(
            expect.stringContaining(expectedOutput),
          );
        }
      },
    );
  });

  describe('studies should be valid in invalid_seed test dir', () => {
    const invalidSeedsDir = path.join(testDataDir, 'invalid_seeds');

    it.each(fss.readdirSync(invalidSeedsDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(invalidSeedsDir, testCase);
        const studyFiles = fss.readdirSync(path.join(testCaseDir, 'studies'));

        for (const study of studyFiles) {
          const studyFile = path.join(testCaseDir, 'studies', study);

          await check_study.parseAsync(['node', 'check_study', studyFile]);
          expect(exitMock).toHaveBeenCalledTimes(0);
          expect(errorMock).toHaveBeenCalledTimes(0);
        }
      },
    );
  });
});
