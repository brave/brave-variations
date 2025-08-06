// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs_sync from 'fs';
import { promises as fs } from 'fs';
import assert from 'node:assert';
import { afterEach, beforeEach, mock, test } from 'node:test';
import * as os from 'os';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import create from './create';
import lint from './lint';

test('lint command', async () => {
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

  await test('lint valid studies', async () => {
    const unformattedStudiesDir = path.join(testDataDir, 'valid_seeds');

    for (const testCase of fs_sync.readdirSync(unformattedStudiesDir)) {
      await test(`correctly lints ${testCase}`, async () => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');

        await lint().parseAsync(['node', 'lint', studiesDir]);

        assert.strictEqual(errorOutput, '');
      });
    }
  });

  await test('lint unformatted studies', async () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    for (const testCase of fs_sync.readdirSync(unformattedStudiesDir)) {
      await test(`correctly lints ${testCase}`, async () => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');

        await assert.rejects(
          lint().parseAsync(['node', 'lint', studiesDir]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected lint to fail with exit code 1',
            );
            return true;
          },
        );

        const expectedOutput = fs_sync.readFileSync(
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

  await test('fix unformatted studies', async () => {
    const unformattedStudiesDir = path.join(testDataDir, 'unformatted_studies');

    for (const testCase of fs_sync.readdirSync(unformattedStudiesDir)) {
      await test(`correctly fixes ${testCase}`, async () => {
        const testCaseDir = path.join(unformattedStudiesDir, testCase);
        const studiesDir = path.join(testCaseDir, 'studies');
        const tempStudiesDir = path.join(tempDir, 'studies');
        const outputFile = path.join(tempDir, 'output.bin');

        // copy the unformatted studies to a temp dir
        await fs.mkdir(tempStudiesDir);
        await fs.copyFile(
          path.join(studiesDir, 'TestStudy.json5'),
          path.join(tempStudiesDir, 'TestStudy.json5'),
        );

        // lint should fail.
        await assert.rejects(
          lint().parseAsync(['node', 'lint', tempStudiesDir]),
          (err: any) => {
            assert.ok(
              err.message.includes('process.exit(1)'),
              'Expected lint to fail before fix',
            );
            return true;
          },
        );

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
      });
    }
  });
});
