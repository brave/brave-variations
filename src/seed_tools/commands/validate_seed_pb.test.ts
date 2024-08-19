// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs_sync from 'fs';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import validate_seed_pb from './validate_seed_pb';

describe('validate_seed_pb command', () => {
  const testDataDir = wsPath('//src/test/data');

  describe('valid seeds', () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    it.each(fs_sync.readdirSync(validSeedsDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(validSeedsDir, testCase);
        const seedBin = path.join(testCaseDir, 'expected_seed.bin');

        await validate_seed_pb.parseAsync([
          'node',
          'validate_seed_pb',
          seedBin,
        ]);
      },
    );
  });

  test('invalid seed', async () => {
    const seedBin = path.join(testDataDir, 'invalid_seed.bin');
    expect(fs_sync.existsSync(seedBin)).toBe(true);
    await expect(
      validate_seed_pb.parseAsync(['node', 'validate_seed_pb', seedBin]),
    ).rejects.toThrow('premature EOF');
  });
});
