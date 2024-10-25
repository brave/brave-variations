// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, test } from '@jest/globals';
import { Study } from '../../proto/generated/study';
import * as study_validation from './study_validation';

describe('getStudyErrors', () => {
  const studyFileBaseName = 'study';

  test('should not error if study is valid', () => {
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

    expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
      [],
    );
  });

  test('should error if study name does not match file name', () => {
    const study = Study.fromJson({
      name: 'study1',
      experiment: [],
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Study name study1 does not match file name'),
    );
  });

  test.each(['study_😀', 'study_,', 'study_<', 'study_*'])(
    'should error if study name has invalid char %s',
    (studyName) => {
      const study = Study.fromJson({
        name: studyName,
        experiment: [],
      });

      expect(
        study_validation.getStudyErrors(study, studyFileBaseName),
      ).toContainEqual(
        expect.stringContaining(`Invalid study name: ${studyName}`),
      );
    },
  );

  test('should error if layer is set', () => {
    const study = Study.fromJson({
      name: 'study',
      layer: {
        layer_id: 1,
        layer_member_id: 1,
      },
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Layers are currently not supported'),
    );
  });

  test('should error if experiment name is not defined', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: '',
          probabilityWeight: 100,
        },
      ],
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining(
        'Experiment name is not defined for study: study',
      ),
    );
  });

  test.each(['exp😀', 'exp<', 'exp*'])(
    'should error if experiment name has invalid char %s',
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

      expect(
        study_validation.getStudyErrors(study, studyFileBaseName),
      ).toContainEqual(
        expect.stringContaining(`Invalid experiment name: ${experimentName}`),
      );
    },
  );

  test('should not error if experiment name has comma', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1,',
          probability_weight: 100,
        },
      ],
      filter: {
        platform: ['PLATFORM_LINUX'],
        channel: ['BETA'],
      },
    });

    expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
      [],
    );
  });

  test('should error if duplicate experiment names are found', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Duplicate experiment name: experiment1'),
    );
  });

  test('should error if feature name is not defined', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment',
          feature_association: {
            enable_feature: [''],
          },
          probabilityWeight: 100,
        },
      ],
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining(
        'Feature name is not defined for experiment: experiment',
      ),
    );
  });

  test.each(['feature😀', 'feature,', 'feature<', 'feature*'])(
    'should error if feature name has invalid char %s',
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

        expect(
          study_validation.getStudyErrors(study, studyFileBaseName),
        ).toContainEqual(
          expect.stringContaining(
            `Invalid feature name for experiment experiment: ${featureName}`,
          ),
        );
      }
    },
  );

  test('should error if feature is duplicated', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          feature_association: {
            enable_feature: ['Feature'],
            disable_feature: ['Feature'],
          },
        },
      ],
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(expect.stringContaining(`Duplicate feature name`));
  });

  test('should not error if forcing flag is correct', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
          forcing_flag: 'hello',
        },
      ],
      filter: {
        platform: ['PLATFORM_LINUX'],
        channel: ['BETA'],
      },
    });

    expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
      [],
    );
  });

  test.each(['Hello', ''])(
    'should error if forcing flag is incorrect %s',
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
        filter: {
          platform: ['PLATFORM_LINUX'],
          channel: ['BETA'],
        },
      });

      expect(
        study_validation.getStudyErrors(study, studyFileBaseName),
      ).toContainEqual(
        expect.stringContaining(
          'Invalid forcing flag for experiment experiment1',
        ),
      );
    },
  );

  test.each([
    [true, true, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])(
    'should throw on mixed forcing options',
    (forcingFeatureOn, forcingFeatureOff, forcingFlag) => {
      const studyJson = {
        name: 'study',
        experiment: [
          {
            name: 'experiment1',
            probability_weight: 100,
            feature_association: {},
          },
        ],
      };
      if (forcingFeatureOn) {
        (
          studyJson.experiment[0].feature_association as any
        ).forcing_feature_on = 'feature1';
      }
      if (forcingFeatureOff) {
        (
          studyJson.experiment[0].feature_association as any
        ).forcing_feature_off = 'feature1';
      }
      if (forcingFlag) {
        (studyJson.experiment[0] as any).forcing_flag = 'feature1';
      }

      const study = Study.fromJson(studyJson);

      expect(
        study_validation.getStudyErrors(study, studyFileBaseName),
      ).toContainEqual(
        expect.stringContaining(
          'Forcing feature_on, feature_off and flag are mutually exclusive',
        ),
      );
    },
  );

  test.each([
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ])(
    'should not error on correct forcing options use',
    (forcingFeatureOn, forcingFeatureOff, forcingFlag) => {
      const studyJson = {
        name: 'study',
        experiment: [
          {
            name: 'experiment1',
            probability_weight: 100,
            feature_association: {},
          },
        ],
        filter: {
          platform: ['PLATFORM_LINUX'],
          channel: ['BETA'],
        },
      };
      if (forcingFeatureOn) {
        (
          studyJson.experiment[0].feature_association as any
        ).forcing_feature_on = 'feature1';
      }
      if (forcingFeatureOff) {
        (
          studyJson.experiment[0].feature_association as any
        ).forcing_feature_off = 'feature1';
      }
      if (forcingFlag) {
        (studyJson.experiment[0] as any).forcing_flag = 'feature1';
      }

      const study = Study.fromJson(studyJson);

      expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
        [],
      );
    },
  );

  test('should error if google_web_experiment/trigger_id conflict', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining(
        'Experiment experiment1 has both google_web_experiment_id and web_trigger_experiment_id',
      ),
    );
  });

  test('should error if param name is empty', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Empty param name in experiment experiment1'),
    );
  });

  test('should error if params conflict', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining(
        'Duplicate param name: test in experiment experiment1',
      ),
    );
  });

  test('should error if default_experiment_name not found', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining(
        'Missing default experiment: DefaultExp in study study',
      ),
    );
  });

  test('should error if total probability is not 100', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Total probability is not 100 for study study'),
    );
  });

  test('should error if conflicting filter properties are found', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Filter conflict: exclude_locale and locale'),
    );
  });

  test('should not error if conflicting filter is empty', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: {
        platform: ['PLATFORM_LINUX'],
        channel: ['BETA'],
        locale: [],
        exclude_locale: ['en'],
      },
    });

    expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
      [],
    );
  });

  test('should error if version range is invalid', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(expect.stringContaining('Invalid version range'));
  });

  test('should error if version is invalid', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('contains non-numeric characters'),
    );
  });

  test.each([
    { min_version: '130.0.6517.0' },
    { max_version: '135.0.6707.0' },
    { min_version: '1.65.70' },
    { min_version: '82.0.4056.0' },
    { min_version: '79.0.3945.0' },
  ])('should error if version is non-Brave %s', (filter: any) => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter,
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(
      expect.stringContaining('Detected non-Brave version in a filter'),
    );
  });

  test.each([
    { min_version: '130.1.70.0' },
    { max_version: '135.1.91.0' },
    { min_version: '80.1.8.1' },
  ])('should not error if version is Brave %s', (filter: any) => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: { ...filter, platform: ['PLATFORM_LINUX'], channel: ['BETA'] },
    });

    expect(study_validation.getStudyErrors(study, studyFileBaseName)).toEqual(
      [],
    );
  });

  test('should error if os version range is invalid', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(expect.stringContaining('Invalid os_version range'));
  });

  test('should error if date range is invalid', () => {
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

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(expect.stringContaining('Invalid date range'));
  });

  test.each([{}, { channel: [] }, { channel: ['BETA', 'BETA'] }])(
    'should error if channel is invalid',
    (filter: any) => {
      const study = Study.fromJson({
        name: 'study',
        experiment: [
          {
            name: 'experiment1',
            probability_weight: 100,
          },
        ],
        filter: { ...filter, platform: ['PLATFORM_LINUX'] },
      });

      expect(
        study_validation.getStudyErrors(study, studyFileBaseName),
      ).toContainEqual(expect.stringMatching(/(C|c)hannel/));
    },
  );

  test.each([
    {},
    { platform: [] },
    { platform: ['PLATFORM_LINUX', 'PLATFORM_LINUX'] },
  ])('should error if platform is invalid', (filter: any) => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: 'experiment1',
          probability_weight: 100,
        },
      ],
      filter: { ...filter, channel: ['BETA'] },
    });

    expect(
      study_validation.getStudyErrors(study, studyFileBaseName),
    ).toContainEqual(expect.stringMatching(/(P|p)latform/));
  });
});
