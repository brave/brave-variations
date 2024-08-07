// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, test } from '@jest/globals';
import { Study } from '../../proto/generated/study';
import * as study_validation from './study_validation';

describe('validateStudy', () => {
  const studyFilePath = '/path/to/study.json';

  test('should not throw an error if study is valid', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 50,
          param: [],
          override_ui_string: [],
        },
        {
          name: 'experiment2',
          probability_weight: 50,
          param: [],
          override_ui_string: [],
        },
      ],
      filter: {
        locale: ['en'],
        channel: ['CANARY'],
        platform: ['PLATFORM_WINDOWS'],
        start_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
        end_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
        min_version: '1.0',
        max_version: '2.0',
        min_os_version: '10.0',
        max_os_version: '11.0',
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).not.toThrow();
  });

  test('should throw an error if study name does not match file name', () => {
    const study = Study.fromJson({
      name: 'study1',
      experiment: [],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Study name study1 does not match file name');
  });

  test('should throw an error if experiment name is not defined', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: '',
          probabilityWeight: 50,
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Experiment name is not defined for study study');
  });

  test('should throw an error if duplicate experiment names are found', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 50,
          param: [],
          override_ui_string: [],
        },
        {
          name: 'experiment1',
          probability_weight: 50,
          param: [],
          override_ui_string: [],
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Duplicate experiment name: experiment1');
  });

  test('should throw an error if total probability is not 100', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 50,
          param: [],
          override_ui_string: [],
        },
        {
          name: 'experiment2',
          probability_weight: 30,
          param: [],
          override_ui_string: [],
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Total probability is not 100 for study study');
  });

  test('should throw an error if conflicting filter properties are found', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        locale: ['ar'],
        exclude_locale: ['en'],
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Filter conflict: exclude_locale and locale');
  });

  test('should not throw if conflicting filter is empty', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        locale: [],
        exclude_locale: ['en'],
      },
    });

    study_validation.validateStudy(study, studyFilePath);
  });

  test('should throw an error if version range is invalid', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        min_version: '2.0',
        max_version: '1.0',
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Invalid version range');
  });

  test('should throw an error if version is invalid', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        min_version: '2.a',
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('contains non-numeric characters');
  });

  test('should throw an error if os version range is invalid', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        min_os_version: '2.0',
        max_os_version: '1.0',
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Invalid os_version range');
  });

  test('should throw an error if date range is invalid', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        start_date: Math.floor(new Date('2022-02-01').getTime() / 1000),
        end_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Invalid date range');
  });
});
