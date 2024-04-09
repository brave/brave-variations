// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from 'fs';

import { serializeStudies } from './tracker_lib';
import { expect, test, describe } from '@jest/globals';
import { variations as proto } from '../proto/generated/proto_bundle';
import { ItemAction, makeSummary, summaryToJson } from '../core/summary';
import { StudyPriority } from '../core/study_processor';

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
  const data = fs.readFileSync('src/test/data/seed1.bin');
  const map = serializeStudies(data, {
    minMajorVersion: 116,
    isBraveSeed: true,
  });
  const serializedOutput = serialize(map);

  const serializedExpectations = fs
    .readFileSync('src/test/data/seed1.bin.processing_expectations')
    .toString();

  if (serializedExpectations !== serializedOutput) {
    const fileName = 'src/test/data/seed1.bin.failed';
    console.log('Saving non-matching output as ', fileName);
    fs.writeFileSync(fileName, serializedOutput);
  }

  expect(serializedOutput).toBe(serializedExpectations);
});

describe('summary', () => {
  const common = {
    name: 'TestStudy',
    filter: {
      channel: [proto.Study.Channel.STABLE],
      platform: [proto.Study.Platform.PLATFORM_WINDOWS],
    },
  };
  const oldStudy = new proto.Study({
    ...common,
    experiment: [
      {
        name: 'Enabled',
        probability_weight: 20,
        feature_association: { enable_feature: ['GoodFeature'] },
      },
      {
        name: 'Default',
        probability_weight: 80,
      },
    ],
  });

  const newStudy = new proto.Study({
    ...common,
    experiment: [
      {
        name: 'Enabled',
        probability_weight: 20,
        feature_association: { enable_feature: ['GoodFeature'] },
      },
      {
        name: 'DisableAnother',
        probability_weight: 70,
        feature_association: { disable_feature: ['BadFeature'] },
      },
      {
        name: 'Default',
        probability_weight: 10,
      },
    ],
  });
  const oldSeed = new proto.VariationsSeed({ study: [oldStudy] });
  const newSeed = new proto.VariationsSeed({ study: [newStudy] });

  const summary = makeSummary(
    oldSeed,
    newSeed,
    { minMajorVersion: 116, isBraveSeed: true },
    StudyPriority.STABLE_MIN,
  );

  test('verify content', () => {
    expect(summary.size).toBe(1);
    const itemList = summary.get(StudyPriority.STABLE_ALL);
    expect(itemList?.length).toBe(1);
    const item = itemList?.at(0);

    expect(item?.studyName).toBe('TestStudy');

    expect(item?.oldPriority).toBe(StudyPriority.STABLE_MIN);
    expect(item?.newPriority).toBe(StudyPriority.STABLE_ALL);
    expect(item?.action).toBe(ItemAction.Up);

    expect(item?.oldAudience).toBe(0.2);
    expect(item?.newAudience).toBe(0.9);

    expect(item?.affectedFeatures.size).toBe(2);
    expect(item?.affectedFeatures).toContain('GoodFeature');
    expect(item?.affectedFeatures).toContain('BadFeature');
  });

  test('serialization', () => {
    const payloadJSON = summaryToJson(summary, undefined);
    expect(payloadJSON).toBeDefined();
    const payload =
      payloadJSON !== undefined ? JSON.parse(payloadJSON) : undefined;

    // Check that payload is valid JSON.
    expect(payload).toBeInstanceOf(Object);
  });
});
