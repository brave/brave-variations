// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { exec } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

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

  return await new Promise<string>((resolve, reject) => {
    // Use git diff to generate readable diff.
    exec(
      `git diff --no-index --src-prefix= --dst-prefix= -- ${tmpFile1} ${tmpFile2}`,
      { encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error !== null && error.code !== 1) {
          // git diff returns 1 if there are differences
          reject(new Error(stderr));
          return;
        }

        const result = stdout
          .replaceAll(tmpFile1, displayFileName1)
          .replaceAll(tmpFile2, displayFileName2);

        resolve(result);
      },
    );
  }).finally(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      // Clean up temporary directory.
      await fs.rm(tmpDir, { recursive: true });
    })();
  });
}
