// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Study } from '../../proto/generated/study';
import * as study_validation from './study_validation';

describe('getStudyErrors', () => {
  const studyFileBaseName = 'study';

  it('should not error if study is valid', () => {
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

    assert.deepStrictEqual(
      study_validation.getStudyErrors(study, studyFileBaseName),
      [],
    );
  });

  it('should error if study name does not match file name', () => {
    const study = Study.fromJson({
      name: 'study1',
      experiment: [],
    });

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Study name study1 does not match file name'),
      ),
    );
  });

  const invalidStudyNames = ['study_😀', 'study_,', 'study_<', 'study_*'];
  for (const studyName of invalidStudyNames) {
    it(`should error if study name has invalid char ${studyName}`, () => {
      const study = Study.fromJson({
        name: studyName,
        experiment: [],
      });

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(
        errors.some((error) =>
          error.includes(`Invalid study name: ${studyName}`),
        ),
      );
    });
  }

  it('should error if layer is set', () => {
    const study = Study.fromJson({
      name: 'study',
      layer: {
        layer_id: 1,
        layer_member_id: 1,
      },
    });

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Layers are currently not supported'),
      ),
    );
  });

  it('should error if experiment name is not defined', () => {
    const study = Study.fromJson({
      name: 'study',
      experiment: [
        {
          name: '',
          probabilityWeight: 100,
        },
      ],
    });

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Experiment name is not defined for study: study'),
      ),
    );
  });

  const invalidExperimentNames = ['exp😀', 'exp<', 'exp*', 'exp,'];
  for (const experimentName of invalidExperimentNames) {
    it(`should error if experiment name has invalid char ${experimentName}`, () => {
      const study = Study.fromJson({
        name: 'study',
        experiment: [
          {
            name: experimentName,
            probabilityWeight: 100,
          },
        ],
      });

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(
        errors.some((error) =>
          error.includes(`Invalid experiment name: ${experimentName}`),
        ),
      );
    });
  }

  it('should error if duplicate experiment names are found', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Duplicate experiment name: experiment1'),
      ),
    );
  });

  it('should error if feature name is not defined', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes(
          'Feature name is not defined for experiment: experiment',
        ),
      ),
    );
  });

  const invalidFeatureNames = ['feature😀', 'feature,', 'feature<', 'feature*'];
  for (const featureName of invalidFeatureNames) {
    it(`should error if feature name has invalid char ${featureName}`, () => {
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

        const errors = study_validation.getStudyErrors(
          study,
          studyFileBaseName,
        );
        assert.ok(
          errors.some((error) =>
            error.includes(
              `Invalid feature name: ${featureName} (use only 0-9,a-z,A-Z,_,-)`,
            ),
          ),
        );
      }
    });
  }

  it('should error if feature is duplicated', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(errors.some((error) => error.includes(`Duplicate feature name`)));
  });

  it('should not error if forcing flag is correct', () => {
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

    assert.deepStrictEqual(
      study_validation.getStudyErrors(study, studyFileBaseName),
      [],
    );
  });

  const incorrectForcingFlags = ['Hello', ''];
  for (const forcingFlag of incorrectForcingFlags) {
    it(`should error if forcing flag is incorrect ${forcingFlag}`, () => {
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

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(
        errors.some((error) =>
          error.includes('Invalid forcing flag for experiment experiment1'),
        ),
      );
    });
  }

  const mixedForcingOptions = [
    [true, true, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ];
  for (const [
    forcingFeatureOn,
    forcingFeatureOff,
    forcingFlag,
  ] of mixedForcingOptions) {
    it(
      'should throw on mixed forcing options' +
        `${forcingFeatureOn}, ${forcingFeatureOff}, ${forcingFlag}`,
      () => {
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

        const errors = study_validation.getStudyErrors(
          study,
          studyFileBaseName,
        );
        assert.ok(
          errors.some((error) =>
            error.includes(
              'Forcing feature_on, feature_off and flag are mutually exclusive',
            ),
          ),
        );
      },
    );
  }

  const correctForcingOptions = [
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ];
  for (const [
    forcingFeatureOn,
    forcingFeatureOff,
    forcingFlag,
  ] of correctForcingOptions) {
    it(
      'should not error on correct forcing options use' +
        `${forcingFeatureOn}, ${forcingFeatureOff}, ${forcingFlag}`,
      () => {
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

        assert.deepStrictEqual(
          study_validation.getStudyErrors(study, studyFileBaseName),
          [],
        );
      },
    );
  }

  it('should error if google_web_experiment/trigger_id conflict', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes(
          'Experiment experiment1 has both google_web_experiment_id and web_trigger_experiment_id',
        ),
      ),
    );
  });

  it('should error if param name is empty', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Empty param name in experiment experiment1'),
      ),
    );
  });

  it('should error if params conflict', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Duplicate param name: test in experiment experiment1'),
      ),
    );
  });

  it('should error if default_experiment_name not found', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Missing default experiment: DefaultExp in study study'),
      ),
    );
  });

  it('should error if total probability is not 100', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Total probability is not 100 for study study'),
      ),
    );
  });

  it('should error if conflicting filter properties are found', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) =>
        error.includes('Filter conflict: exclude_locale and locale'),
      ),
    );
  });

  it('should not error if conflicting filter is empty', () => {
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

    assert.deepStrictEqual(
      study_validation.getStudyErrors(study, studyFileBaseName),
      [],
    );
  });

  it('should error if version range is invalid', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(errors.some((error) => error.includes('Invalid version range')));
  });

  it('should error if version is invalid', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) => error.includes('contains non-numeric characters')),
    );
  });

  const nonBraveVersions = [
    { min_version: '130.0.6517.0' },
    { max_version: '135.0.6707.0' },
    { min_version: '1.65.70' },
    { min_version: '82.0.4056.0' },
    { min_version: '79.0.3945.0' },
  ];
  for (const filter of nonBraveVersions) {
    it(`should error if version is non-Brave ${JSON.stringify(filter)}`, () => {
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

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(
        errors.some((error) =>
          error.includes('Detected non-Brave version in a filter'),
        ),
      );
    });
  }

  const braveVersions = [
    { min_version: '130.1.70.0' },
    { max_version: '135.1.91.0' },
    { min_version: '80.1.8.1' },
  ];
  for (const filter of braveVersions) {
    it(`should not error if version is Brave ${JSON.stringify(filter)}`, () => {
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

      assert.deepStrictEqual(
        study_validation.getStudyErrors(study, studyFileBaseName),
        [],
      );
    });
  }

  it('should error if os version range is invalid', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(
      errors.some((error) => error.includes('Invalid os_version range')),
    );
  });

  it('should error if date range is invalid', () => {
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

    const errors = study_validation.getStudyErrors(study, studyFileBaseName);
    assert.ok(errors.some((error) => error.includes('Invalid date range')));
  });

  const invalidChannelFilters = [
    {},
    { channel: [] },
    { channel: ['BETA', 'BETA'] },
  ];
  for (const filter of invalidChannelFilters) {
    it(`should error if channel is invalid ${JSON.stringify(filter)}`, () => {
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

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(errors.some((error) => /[Cc]hannel/.test(error)));
    });
  }

  const invalidPlatformFilters = [
    {},
    { platform: [] },
    { platform: ['PLATFORM_LINUX', 'PLATFORM_LINUX'] },
  ];
  for (const filter of invalidPlatformFilters) {
    it(`should error if platform is invalid ${JSON.stringify(filter)}`, () => {
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

      const errors = study_validation.getStudyErrors(study, studyFileBaseName);
      assert.ok(errors.some((error) => /[Pp]latform/.test(error)));
    });
  }
});
