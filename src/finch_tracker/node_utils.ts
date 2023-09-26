// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as https from 'https';
import * as path from 'path';

export async function downloadUrl(url: string): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const data: any = [];
    https
      .get(url, (res) => {
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          resolve(Buffer.concat(data));
        });
      })
      .on('error', reject);
  });
}

export function getSeedPath(storageDir: string): string {
  return path.join(storageDir, 'seed.bin');
}

export function getStudyPath(storageDir: string): string {
  return path.join(storageDir, 'study');
}
