// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Study } from '../../proto/generated/study';
import { type VariationsSeed } from '../../proto/generated/variations_seed';
import { validateSeed } from './seed_validation';

describe('validateSeed', () => {
  describe('checkOverlappingStudies', () => {
    function toFilterDate(date: string): number {
      return new Date(date).getTime() / 1000;
    }

    function createStudyWithFilter(name: string, filter: any): Study {
      const study: Record<string, any> = {
        name,
        experiment: [
          {
            feature_association: {
              enable_feature: ['feature1'],
            },
          },
        ],
      };
      if (filter !== null) {
        study.filter = filter;
      }
      return Study.fromJson(study, {
        ignoreUnknownFields: false,
      });
    }

    const testCases = [
      // start/end date tests.
      {
        // simple case
        filter1: {
          start_date: toFilterDate('2022-01-01'),
          end_date: toFilterDate('2022-02-01'),
        },
        filter2: {
          start_date: toFilterDate('2022-01-15'),
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: true,
      },
      {
        // start and end dates are the same. The dates should be inclusive.
        filter1: {
          start_date: toFilterDate('2022-01-01'),
          end_date: toFilterDate('2022-02-01'),
        },
        filter2: {
          start_date: toFilterDate('2022-02-01'),
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: true,
      },
      {
        // non-overlapping dates
        filter1: {
          start_date: toFilterDate('2022-01-01'),
          end_date: toFilterDate('2022-02-01'),
        },
        filter2: {
          start_date: toFilterDate('2022-02-02'),
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: false,
      },
      {
        // no end date in the first, no start date in the second.
        filter1: {
          start_date: toFilterDate('2022-01-01'),
        },
        filter2: {
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: true,
      },
      {
        // no end date in the first, no start date in the second, inclusive dates.
        filter1: {
          start_date: toFilterDate('2022-02-15'),
        },
        filter2: {
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: true,
      },
      {
        // no end date in the first, no start date in the second, non-overlapping
        // dates.
        filter1: {
          start_date: toFilterDate('2022-02-16'),
        },
        filter2: {
          end_date: toFilterDate('2022-02-15'),
        },
        expectedOverlapped: false,
      },
      {
        // no start date in the first, no end date in the second.
        filter1: {
          end_date: toFilterDate('2022-02-01'),
        },
        filter2: {
          start_date: toFilterDate('2022-01-15'),
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          end_date: toFilterDate('2022-02-01'),
        },
        filter2: {
          start_date: toFilterDate('2022-02-01'),
        },
        expectedOverlapped: true,
      },

      // min/max version tests.
      {
        filter1: {
          min_version: '1.0.0',
          max_version: '2.0.0',
        },
        filter2: {
          min_version: '1.5.0',
          max_version: '2.5.0',
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          min_version: '1.0.0',
          max_version: '2.0.0',
        },
        filter2: {
          min_version: '1.*',
          max_version: '2.*',
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          min_version: '1.0.0',
          max_version: '2.0.0',
        },
        filter2: {
          min_version: '2.1.*',
          max_version: '2.*',
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          min_version: '1.5.0',
          max_version: '2.0.0',
        },
        filter2: {
          min_version: '1.*',
          max_version: '1.5.*',
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          min_version: '1.5.0',
          max_version: '2.0.0',
        },
        filter2: {},
        expectedOverlapped: true,
      },

      // platform tests
      {
        filter1: {
          platform: ['PLATFORM_WINDOWS', 'PLATFORM_MAC'],
        },
        filter2: {
          platform: ['PLATFORM_MAC'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          platform: ['PLATFORM_WINDOWS'],
        },
        filter2: {
          platform: ['PLATFORM_MAC'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          platform: [],
        },
        filter2: {
          platform: [],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          platform: [],
        },
        filter2: {},
        expectedOverlapped: true,
      },

      // channel tests
      {
        filter1: {
          channel: ['BETA', 'STABLE'],
        },
        filter2: {
          channel: ['BETA'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          channel: ['STABLE'],
        },
        filter2: {
          channel: ['BETA'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          channel: [],
        },
        filter2: {
          channel: [],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          channel: [],
        },
        filter2: {},
        expectedOverlapped: true,
      },

      // is_low_end_device tests
      {
        filter1: {
          is_low_end_device: false,
        },
        filter2: {
          is_low_end_device: true,
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          is_low_end_device: false,
        },
        filter2: {
          is_low_end_device: false,
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          is_low_end_device: true,
        },
        filter2: {
          is_low_end_device: true,
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          is_low_end_device: true,
        },
        filter2: {},
        expectedOverlapped: false,
      },

      // locale tests (make sure exclude_locale field is handled correctly)
      {
        filter1: {
          locale: ['fr'],
        },
        filter2: {
          locale: ['en'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          locale: ['fr'],
        },
        filter2: {},
        expectedOverlapped: true,
      },
      {
        filter1: {},
        filter2: {
          exclude_locale: ['fr'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          locale: ['en', 'fr'],
        },
        filter2: {
          exclude_locale: ['en'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          exclude_locale: ['en'],
        },
        filter2: {
          locale: ['en', 'fr'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          locale: ['en'],
        },
        filter2: {
          exclude_locale: ['en', 'fr'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          exclude_locale: ['en', 'fr'],
        },
        filter2: {
          locale: ['en'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          locale: ['en'],
        },
        filter2: {
          exclude_locale: ['en'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          exclude_locale: ['en'],
        },
        filter2: {
          locale: ['en'],
        },
        expectedOverlapped: false,
      },
      {
        filter1: {
          exclude_locale: ['en'],
        },
        filter2: {
          exclude_locale: ['fr'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          exclude_locale: ['fr'],
        },
        filter2: {
          exclude_locale: ['en'],
        },
        expectedOverlapped: true,
      },
      {
        filter1: {
          exclude_locale: ['en'],
        },
        filter2: {
          exclude_locale: ['en'],
        },
        expectedOverlapped: true,
      },

      // no filter at all
      {
        filter1: null,
        filter2: null,
        expectedOverlapped: true,
      },
    ];

    testCases.forEach((testCase) => {
      it(`${JSON.stringify([testCase.filter1, testCase.filter2])}`, () => {
        const seed: VariationsSeed = {
          study: [
            createStudyWithFilter('study1', testCase.filter1),
            createStudyWithFilter('study2', testCase.filter2),
          ],
        } as unknown as VariationsSeed;

        if (testCase.expectedOverlapped) {
          expect(() => {
            validateSeed(seed);
          }).toThrowError('overlaps in studies');
        } else {
          expect(() => {
            validateSeed(seed);
          }).not.toThrow();
        }
      });
    });
  });
});
