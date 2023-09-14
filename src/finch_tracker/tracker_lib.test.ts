// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { serializeStudies } from './tracker_lib';
import { expect, test } from '@jest/globals';

import * as fs from 'fs';

function serialize(json: Record<string, any>) {
  const ordered = Object.keys(json)
    .sort()
    .reduce((res: Record<string, any>, key) => {
      res[key] = json[key];
      return res;
    }, {});
  return JSON.stringify(ordered, undefined, 2);
}

test('seed serialization', () => {
  const data = fs.readFileSync('test/data/seed1.bin');
  const map = serializeStudies(data, { minMajorVersion: 116 });
  const serializedOutput = serialize(map);

  const serializedExpectations = fs
    .readFileSync('test/data/seed1.bin.processing_expectations')
    .toString();

  if (serializedExpectations !== serializedOutput) {
    const fileName = 'test/data/seed1.bin.failed';
    console.log('Saving non-matching output as ', fileName);
    fs.writeFileSync(fileName, serializedOutput);
  }

  expect(serializedOutput).toBe(serializedExpectations);
});
