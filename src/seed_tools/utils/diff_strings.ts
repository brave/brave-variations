// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { exec } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function diffStrings(
  string1: string,
  string2: string,
  displayFileName1: string,
  displayFileName2: string,
): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffString-'));

  const tmpFile1 = path
    .join(tmpDir, `file1-${Date.now()}.txt`)
    .replaceAll('\\', '/');
  const tmpFile2 = path
    .join(tmpDir, `file2-${Date.now()}.txt`)
    .replaceAll('\\', '/');

  // Write strings to temporary files.
  await fs.writeFile(tmpFile1, string1);
  await fs.writeFile(tmpFile2, string2);

  try {
    // Run git diff on the temporary files, on non-empty diff it will exit with
    // code 1.
    await execAsync(
      `git diff --no-index --src-prefix= --dst-prefix= -- ${tmpFile1} ${tmpFile2}`,
      { encoding: 'utf8' },
    );
    return '';
  } catch (error) {
    if (error.code === 1) {
      // Handle the case where git diff returns 1 due to differences.
      const result = error.stdout
        .replaceAll(tmpFile1, displayFileName1)
        .replaceAll(tmpFile2, displayFileName2);

      return result;
    } else {
      // Rethrow the error for other exit codes.
      throw error;
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true });
  }
}
