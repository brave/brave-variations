// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs_sync from 'fs';
import * as path from 'path';
import { wsPath } from '../../base/path_utils';
import validate_seed from './validate_seed';

describe('validate_seed command', () => {
  const testDataDir = wsPath('//src/test/data');

  let errorMock: jest.SpyInstance;
  let exitMock: jest.SpyInstance;

  beforeEach(() => {
    errorMock = jest.spyOn(console, 'error').mockImplementation();
    exitMock = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('valid seeds', () => {
    const validSeedsDir = path.join(testDataDir, 'valid_seeds');
    it.each(fs_sync.readdirSync(validSeedsDir))(
      'correctly validates %s',
      async (testCase) => {
        const testCaseDir = path.join(validSeedsDir, testCase);
        const seedBin = path.join(testCaseDir, 'expected_seed.bin');

        await validate_seed.parseAsync(['node', 'validate_seed', seedBin]);

        expect(errorMock).toHaveBeenCalledTimes(0);
        expect(exitMock).toHaveBeenCalledWith(0);
      },
    );
  });

  test('invalid seed', async () => {
    const seedBin = path.join(testDataDir, 'invalid_seed.bin');
    expect(fs_sync.existsSync(seedBin)).toBe(true);

    await validate_seed.parseAsync(['node', 'validate_seed', seedBin]);

    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'Total probability is not 100 for study AllowCertainClientHintsStudy',
      ),
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
