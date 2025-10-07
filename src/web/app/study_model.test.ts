// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { PartialMessage } from '@protobuf-ts/runtime';
import assert from 'node:assert';
import { describe, test } from 'node:test';
import { SeedType } from '../../core/base_types';
import {
  ProcessedStudy,
  StudyFilter,
  StudyPriority,
} from '../../core/study_processor';
import {
  Study,
  Study_Channel,
  Study_Platform,
} from '../../proto/generated/study';
import { StudyListModel, StudyModel } from './study_model';

function makeStudyModel(properties: PartialMessage<Study>) {
  const study = Study.create(properties);
  const processed = new ProcessedStudy(study, {
    minMajorVersion: 116,
    isBraveSeed: true,
  });
  const randomID = Math.floor(Math.random() * 1000000);
  return new StudyModel(processed, SeedType.MAIN, randomID);
}

describe('models', () => {
  const study1 = makeStudyModel({
    name: 'Study1',
    experiment: [
      {
        name: 'Enabled',
        probability_weight: 200,
        feature_association: {
          enable_feature: ['EnabledFeature1', 'EnabledFeature2'],
          disable_feature: ['DisabledFeature'],
        },
        param: [{ name: 'OsBlocklist', value: 'MacOs' }],
      },
      {
        name: 'Empty',
        probability_weight: 0,
      },
      {
        name: 'Default',
        probability_weight: 800,
      },
    ],
    filter: {
      channel: [Study_Channel.STABLE, Study_Channel.CANARY],
      platform: [Study_Platform.WINDOWS, Study_Platform.IOS],
    },
  });

  const outdatedStudy = makeStudyModel({
    name: 'OutdatedStudy',
    experiment: [
      {
        name: 'Some',
        probability_weight: 100,
      },
    ],
    filter: {
      channel: [Study_Channel.STABLE, Study_Channel.CANARY],
      platform: [Study_Platform.WINDOWS],
      max_version: '110.0.0.0',
    },
  });

  const betaStudy = makeStudyModel({
    name: 'BetaStudy',
    experiment: [
      {
        name: 'Some',
        probability_weight: 100,
      },
    ],
    filter: {
      channel: [Study_Channel.BETA],
      platform: [Study_Platform.WINDOWS],
    },
  });

  test('basic', () => {
    const studyList = new StudyListModel([study1]);
    const filter = new StudyFilter();
    assert.strictEqual(studyList.filterStudies(filter).length, 1);

    assert.deepStrictEqual(study1.channels(), ['NIGHTLY', 'RELEASE']);
    assert.deepStrictEqual(study1.platforms(), ['WINDOWS', 'IOS']);
    const experiments = study1.filterExperiments(filter);
    assert.strictEqual(experiments.length, 2);
    assert.strictEqual(experiments[0].name(), 'Enabled');
    assert.strictEqual(experiments[0].weight(), 20);
    assert.strictEqual(experiments[0].isMajorGroup(), false);

    assert.strictEqual(experiments[0].enabledFeatures().length, 2);
    assert.strictEqual(
      experiments[0].enabledFeatures()[0].name,
      'EnabledFeature1',
    );
    assert.ok(experiments[0].enabledFeatures()[0].link.includes('https://'));
    assert.strictEqual(
      experiments[0].enabledFeatures()[1].name,
      'EnabledFeature2',
    );
    assert.ok(experiments[0].enabledFeatures()[1].link.includes('https://'));

    assert.strictEqual(experiments[0].disabledFeatures().length, 1);
    assert.strictEqual(
      experiments[0].disabledFeatures()[0].name,
      'DisabledFeature',
    );
    assert.ok(experiments[0].disabledFeatures()[0].link.includes('https://'));

    assert.strictEqual(experiments[1].name(), 'Default');
    assert.strictEqual(experiments[1].weight(), 80);
    assert.strictEqual(experiments[1].isMajorGroup(), true);
    assert.strictEqual(experiments[1].enabledFeatures().length, 0);
    assert.strictEqual(experiments[1].disabledFeatures().length, 0);
  });

  test('show empty groups', () => {
    const filter = new StudyFilter();
    filter.showEmptyGroups = true;
    const experiments = study1.filterExperiments(filter);
    assert.strictEqual(experiments.length, 3);
  });

  const useFilter = (list: StudyListModel, params: Partial<StudyFilter>) => {
    return list.filterStudies(new StudyFilter(params));
  };

  test('filter-search', () => {
    const studyList = new StudyListModel([study1]);
    assert.strictEqual(
      useFilter(studyList, { search: 'NonMatching' }).length,
      0,
    );
    assert.strictEqual(useFilter(studyList, { search: 'Study1' }).length, 1);
    assert.strictEqual(
      useFilter(studyList, { search: 'DisabledFeature' }).length,
      1,
    );
    assert.strictEqual(
      useFilter(studyList, { search: 'EnabledFeature1' }).length,
      1,
    );
    assert.strictEqual(useFilter(studyList, { search: 'Default' }).length, 1);
    assert.strictEqual(useFilter(studyList, { search: 'OsBlock' }).length, 1);
    assert.strictEqual(useFilter(studyList, { search: 'Mac' }).length, 1);
  });

  test('filter-outdated', () => {
    assert.strictEqual(
      outdatedStudy.processedStudy.studyDetails.isOutdated(),
      true,
    );
    const studyList = new StudyListModel([study1, outdatedStudy]);
    assert.strictEqual(useFilter(studyList, {}).length, 1);

    assert.strictEqual(
      useFilter(studyList, { includeOutdated: true }).length,
      2,
    );
  });

  test('filter-priority', () => {
    const studyList = new StudyListModel([study1, betaStudy]);
    assert.deepStrictEqual(useFilter(studyList, {}), [study1, betaStudy]);

    const stableStudies = useFilter(studyList, {
      minPriority: StudyPriority.STABLE_MIN,
    });
    assert.deepStrictEqual(stableStudies, [study1]);

    const stableAllStudies = useFilter(studyList, {
      minPriority: StudyPriority.STABLE_ALL,
    });
    assert.deepStrictEqual(stableAllStudies, []);
  });
});
