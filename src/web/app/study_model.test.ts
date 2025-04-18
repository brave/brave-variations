// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, test } from '@jest/globals';
import { PartialMessage } from '@protobuf-ts/runtime';
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
    expect(studyList.filterStudies(filter).length).toBe(1);

    expect(study1.channels()).toStrictEqual(['NIGHTLY', 'RELEASE']);
    expect(study1.platforms()).toStrictEqual(['WINDOWS', 'IOS']);
    const experiments = study1.filterExperiments(filter);
    expect(experiments.length).toBe(2);
    expect(experiments[0].name()).toBe('Enabled');
    expect(experiments[0].weight()).toBe(20);
    expect(experiments[0].isMajorGroup()).toBeFalsy();

    expect(experiments[0].enabledFeatures().length).toBe(2);
    expect(experiments[0].enabledFeatures()[0].name).toBe('EnabledFeature1');
    expect(experiments[0].enabledFeatures()[0].link).toContain('https://');
    expect(experiments[0].enabledFeatures()[1].name).toBe('EnabledFeature2');
    expect(experiments[0].enabledFeatures()[1].link).toContain('https://');

    expect(experiments[0].disabledFeatures().length).toBe(1);
    expect(experiments[0].disabledFeatures()[0].name).toBe('DisabledFeature');
    expect(experiments[0].disabledFeatures()[0].link).toContain('https://');

    expect(experiments[1].name()).toBe('Default');
    expect(experiments[1].weight()).toBe(80);
    expect(experiments[1].isMajorGroup()).toBeTruthy();
    expect(experiments[1].enabledFeatures().length).toBe(0);
    expect(experiments[1].disabledFeatures().length).toBe(0);
  });

  test('show empty groups', () => {
    const filter = new StudyFilter();
    filter.showEmptyGroups = true;
    const experiments = study1.filterExperiments(filter);
    expect(experiments.length).toBe(3);
  });

  const useFilter = (list: StudyListModel, params: Partial<StudyFilter>) => {
    return list.filterStudies(new StudyFilter(params));
  };

  test('filter-search', () => {
    const studyList = new StudyListModel([study1]);
    expect(useFilter(studyList, { search: 'NonMatching' }).length).toBe(0);
    expect(useFilter(studyList, { search: 'Study1' }).length).toBe(1);
    expect(useFilter(studyList, { search: 'DisabledFeature' }).length).toBe(1);
    expect(useFilter(studyList, { search: 'EnabledFeature1' }).length).toBe(1);
    expect(useFilter(studyList, { search: 'Default' }).length).toBe(1);
    expect(useFilter(studyList, { search: 'OsBlock' }).length).toBe(1);
    expect(useFilter(studyList, { search: 'Mac' }).length).toBe(1);
  });

  test('filter-outdated', () => {
    expect(outdatedStudy.processedStudy.studyDetails.isOutdated()).toBeTruthy();
    const studyList = new StudyListModel([study1, outdatedStudy]);
    expect(useFilter(studyList, {}).length).toStrictEqual(1);

    expect(useFilter(studyList, { includeOutdated: true }).length).toBe(2);
  });

  test('filter-priority', () => {
    const studyList = new StudyListModel([study1, betaStudy]);
    expect(useFilter(studyList, {})).toStrictEqual([study1, betaStudy]);

    const stableStudies = useFilter(studyList, {
      minPriority: StudyPriority.STABLE_MIN,
    });
    expect(stableStudies).toStrictEqual([study1]);

    const stableAllStudies = useFilter(studyList, {
      minPriority: StudyPriority.STABLE_ALL,
    });
    expect(stableAllStudies).toStrictEqual([]);
  });
});
