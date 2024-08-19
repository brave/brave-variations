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

  test.each(['study_😀', 'study_,', 'study_<', 'study_*'])(
    'should throw an error if study name has invalid char %s',
    (studyName) => {
      const study = Study.fromJson({
        name: studyName,
        experiment: [],
      });

      expect(() => {
        study_validation.validateStudy(study, studyFilePath);
      }).toThrowError(`Invalid study name: ${studyName}`);
    },
  );

  test('should throw an error if layer is set', () => {
    const study = Study.fromJson({
      name: 'study',
      layer: {
        layer_id: 1,
        layer_member_id: 1,
      },
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Layers are currently not supported');
  });

  test('should throw an error if experiment name is not defined', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: '',
          probabilityWeight: 100,
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Experiment name is not defined for study study');
  });

  test.each(['exp😀', 'exp<', 'exp*'])(
    'should throw an error if experiment name has invalid char %s',
    (experimentName) => {
      const study = Study.fromJson({
        name: 'study',
        experiment: [
          {
            name: experimentName,
            probabilityWeight: 100,
          },
        ],
      });

      expect(() => {
        study_validation.validateStudy(study, studyFilePath);
      }).toThrowError(`Invalid experiment name: ${experimentName}`);
    },
  );

  test('should not throw if experiment name has comma', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1,',
          probability_weight: 100,
        },
      ],
    });

    study_validation.validateStudy(study, studyFilePath);
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

  test.each(['feature😀', 'feature,', 'feature<', 'feature*'])(
    'should throw an error if feature name has invalid char %s',
    (featureName) => {
      const featureAssociations = [
        { enable_feature: [featureName] },
        { disable_feature: [featureName] },
        { forcing_feature_on: featureName },
        { forcing_feature_off: featureName },
      ];
      for (const featureAssociation of featureAssociations) {
        const study = Study.fromJson({
          name: 'study',
          experiment: [
            {
              name: 'experiment',
              probabilityWeight: 100,
              feature_association: featureAssociation as any,
            },
          ],
        });

        expect(() => {
          study_validation.validateStudy(study, studyFilePath);
        }).toThrowError(
          `Invalid feature name for experiment experiment: ${featureName}`,
        );
      }
    },
  );

  test('should not throw if forcing flag is correct', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          forcing_flag: 'hello',
        },
      ],
    });

    study_validation.validateStudy(study, studyFilePath);
  });

  test.each(['Hello', ''])(
    'should throw an error if forcing flag is incorrect %s',
    (forcingFlag) => {
      const study = Study.fromJson({
        name: 'study',
        experiment: [
          {
            name: 'experiment1',
            probability_weight: 100,
            forcing_flag: forcingFlag,
          },
        ],
      });

      expect(() => {
        study_validation.validateStudy(study, studyFilePath);
      }).toThrowError('Invalid forcing flag for experiment experiment1');
    },
  );

  test('should throw an error if google_web_experiment/trigger_id conflict', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          google_web_experiment_id: 1,
          google_web_trigger_experiment_id: 2,
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError(
      'Experiment experiment1 has both google_web_experiment_id and web_trigger_experiment_id',
    );
  });

  test('should throw an error if param name is empty', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          param: [
            {
              name: '',
              value: '1',
            },
          ],
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Empty param name in experiment experiment1');
  });

  test('should throw an error if params conflict', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          param: [
            {
              name: 'test',
              value: '1',
            },
            {
              name: 'test',
              value: '2',
            },
          ],
        },
      ],
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Duplicate param name: test in experiment experiment1');
  });

  test('should throw an error if default_experiment_name not found', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      default_experiment_name: 'DefaultExp',
    });

    expect(() => {
      study_validation.validateStudy(study, studyFilePath);
    }).toThrowError('Missing default experiment: DefaultExp in study study');
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
