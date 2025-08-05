// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from 'fs';
import * as os from 'os';

import JSON5 from 'json5';
import assert from 'node:assert';
import { describe, test } from 'node:test';
import path from 'path';
import { asPosix } from '../base/path_utils';
import { StudyPriority } from '../core/study_processor';
import { ItemAction, makeSummary, summaryToJson } from '../core/summary';
import { Study, Study_Channel, Study_Platform } from '../proto/generated/study';
import { VariationsSeed } from '../proto/generated/variations_seed';
import { storeDataToDirectory } from './tracker_lib';

function readDirectory(dir: string): Record<string, any> {
  const files = fs
    .readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .sort()
    .map(asPosix);
  const result: Record<string, string> = {};

  for (const file of files) {
    const filePath = `${dir}/${file}`;
    if (!file.endsWith('.json5')) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    result[file] = JSON5.parse(content);
  }
  return result;
}

test('seed serialization', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-'));
  const data = fs.readFileSync('src/test/data/seed1.bin');
  await storeDataToDirectory(data, tempDir, {
    minMajorVersion: 116,
    isBraveSeed: true,
  });

  const serializedOutput = JSON5.stringify(readDirectory(path.join(tempDir)), {
    space: 2,
  });
  const serializedExpectations = fs
    .readFileSync('src/test/data/seed1.bin.processing_expectations')
    .toString();

  if (serializedExpectations !== serializedOutput) {
    const fileName = 'src/test/data/seed1.bin.failed';
    console.log('Saving non-matching output as ', fileName);
    fs.writeFileSync(fileName, serializedOutput);
  }

  assert.strictEqual(serializedOutput, serializedExpectations);
});

describe('summary', async () => {
  const commonFilters = {
    filter: {
      channel: [Study_Channel.STABLE],
      platform: [Study_Platform.WINDOWS],
      start_date: BigInt(Math.floor(new Date().getTime() / 1000) - 1000),
      end_date: BigInt(Math.floor(new Date().getTime() / 1000) + 1000),
    },
  };
  const oldStudy = Study.create({
    name: 'TestStudy',
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
    ...commonFilters,
  });

  const newStudy = Study.create({
    name: 'TestStudy',
    experiment: [
      {
        name: 'Enabled',
        probability_weight: 20,
        feature_association: { enable_feature: ['GoodFeature'] },
      },
      {
        name: 'DisableAnother',
        probability_weight: 70,
        feature_association: { disable_feature: ['WebUSBBlocklist'] },
      },
      {
        name: 'Default',
        probability_weight: 10,
      },
    ],
    ...commonFilters,
  });
  const killSwitchStudy = Study.create({
    name: 'StudyBrokenFeature_KillSwitch',
    experiment: [
      {
        name: 'BrokenFeature_KillSwitch',
        probability_weight: 100,
        feature_association: { disable_feature: ['BrokenFeature'] },
      },
    ],
    ...commonFilters,
  });
  const oldSeed = VariationsSeed.create({ study: [oldStudy] });
  const newSeed = VariationsSeed.create({ study: [newStudy, killSwitchStudy] });

  const summary = makeSummary(
    oldSeed,
    newSeed,
    { minMajorVersion: 116, isBraveSeed: true },
    StudyPriority.STABLE_MIN,
  );

  await test('verify content', () => {
    assert.strictEqual(summary.size, 2);
    const itemList = summary.get(StudyPriority.STABLE_ALL);
    assert.strictEqual(itemList?.length, 1);
    const item = itemList?.at(0);

    assert.strictEqual(item?.studyName, 'TestStudy');

    assert.strictEqual(item?.oldPriority, StudyPriority.STABLE_MIN);
    assert.strictEqual(item?.newPriority, StudyPriority.STABLE_ALL);
    assert.strictEqual(item?.action, ItemAction.Up);

    assert.strictEqual(item?.oldAudience, 0.2);
    assert.strictEqual(item?.newAudience, 0.9);

    assert.strictEqual(item?.affectedFeatures.size, 2);
    assert.ok(item?.affectedFeatures.has('GoodFeature'));
    assert.ok(item?.affectedFeatures.has('WebUSBBlocklist'));

    const killSwitchItemList = summary.get(
      StudyPriority.STABLE_EMERGENCY_KILL_SWITCH,
    );
    assert.strictEqual(killSwitchItemList?.length, 1);
    const killSwitchItem = killSwitchItemList?.at(0);

    assert.strictEqual(
      killSwitchItem?.studyName,
      'StudyBrokenFeature_KillSwitch',
    );
    assert.strictEqual(killSwitchItem?.affectedFeatures.size, 1);
    assert.ok(killSwitchItem?.affectedFeatures.has('BrokenFeature'));
    assert.strictEqual(
      killSwitchItem?.newPriority,
      StudyPriority.STABLE_EMERGENCY_KILL_SWITCH,
    );
    assert.strictEqual(killSwitchItem?.action, ItemAction.New);
  });

  await test('summaryToSlackJson', () => {
    const payloadString = summaryToJson(summary, undefined);
    assert.ok(payloadString !== undefined);

    assert.ok(
      payloadString.includes(
        'Kill switches changes detected, cc <@U02DG0ATML3>',
      ),
    );

    assert.ok(payloadString.includes('WebUSBBlocklist changes detected'));

    // Check that payload is valid JSON.
    assert.ok(JSON.parse(payloadString) instanceof Object);
  });
});
