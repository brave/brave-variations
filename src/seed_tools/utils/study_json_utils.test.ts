// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  Study,
  Study_Channel,
  Study_Platform,
} from '../../proto/generated/study';
import { parseStudyArray, stringifyStudyArray } from './study_json_utils';

describe('stringifyStudyArray', () => {
  it('should convert start_date and end_date to ISO string', () => {
    const startDate = new Date('2022-01-01T00:00:00Z');
    const endDate = new Date('2022-12-31T23:59:59Z');
    const study = Study.fromJson(
      {
        name: 'study',
        filter: {
          start_date: Math.floor(startDate.getTime() / 1000),
          end_date: Math.floor(endDate.getTime() / 1000),
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudyArray([study]);
    expect(JSON.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'study',
        filter: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
      },
    ]);
  });

  it('should convert channel values', () => {
    const study = Study.fromJson(
      {
        name: 'study',
        filter: {
          channel: ['CANARY', 'BETA', 'STABLE'],
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudyArray([study]);
    expect(JSON.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'study',
        filter: {
          channel: ['NIGHTLY', 'BETA', 'RELEASE'],
        },
      },
    ]);
  });

  it('should not modify other keys', () => {
    const study = Study.fromJson(
      {
        name: 'BraveHorizontalTabsUpdateEnabledStudy',
        experiment: [
          {
            name: 'Enabled',
            probability_weight: 100,
            feature_association: {
              enable_feature: ['BraveHorizontalTabsUpdate'],
            },
          },
        ],
        filter: {
          platform: ['PLATFORM_WINDOWS', 'PLATFORM_MAC'],
          channel: ['CANARY', 'BETA', 'STABLE'],
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudyArray([study]);
    expect(JSON.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'BraveHorizontalTabsUpdateEnabledStudy',
        experiment: [
          {
            name: 'Enabled',
            probability_weight: 100,
            feature_association: {
              enable_feature: ['BraveHorizontalTabsUpdate'],
            },
          },
        ],
        filter: {
          channel: ['NIGHTLY', 'BETA', 'RELEASE'],
          platform: ['PLATFORM_WINDOWS', 'PLATFORM_MAC'],
        },
      },
    ]);
  });
});

describe('parseStudyArray', () => {
  it('should convert ISO string start_date and end_date to Unix timestamp', () => {
    const startDate = '2022-01-01T00:00:00.000Z';
    const endDate = '2022-12-31T23:59:59.999Z';

    const study = JSON.stringify([
      {
        name: 'study',
        filter: {
          start_date: startDate,
          end_date: endDate,
        },
      },
    ]);

    const parsedStudyArray = parseStudyArray(study);
    expect(parsedStudyArray[0].filter?.start_date).toEqual(
      BigInt(Math.floor(new Date(startDate).getTime() / 1000)),
    );
    expect(parsedStudyArray[0].filter?.end_date).toEqual(
      BigInt(Math.floor(new Date(endDate).getTime() / 1000)),
    );
  });

  it('should throw an error for invalid start_date or end_date format', () => {
    const parseStudyWithFilter = (filter: any) => {
      return parseStudyArray(
        JSON.stringify([
          {
            name: 'study',
            filter,
          },
        ]),
      );
    };

    expect(() =>
      parseStudyWithFilter({ start_date: '2022-01-01' }),
    ).toThrowError(
      'Invalid start_date value "2022-01-01", only ISO format with Z timezone is supported',
    );

    expect(() => parseStudyWithFilter({ end_date: '2022-01-01' })).toThrowError(
      'Invalid end_date value "2022-01-01", only ISO format with Z timezone is supported',
    );
  });

  it('should convert channel values from NIGHTLY to CANARY and RELEASE to STABLE', () => {
    const study = JSON.stringify([
      {
        name: 'study',
        filter: {
          channel: ['NIGHTLY', 'BETA', 'RELEASE'],
        },
      },
    ]);

    const parsedStudyArray = parseStudyArray(study);
    expect(parsedStudyArray[0].filter?.channel).toEqual([
      Study_Channel.CANARY,
      Study_Channel.BETA,
      Study_Channel.STABLE,
    ]);
  });

  it('should not modify other keys', () => {
    const study = JSON.stringify([
      {
        name: 'study',
        filter: {
          channel: ['RELEASE', 'BETA', 'NIGHTLY'],
          platform: ['PLATFORM_WINDOWS', 'PLATFORM_MAC'],
        },
      },
    ]);

    const parsedStudyArray = parseStudyArray(study);
    expect(parsedStudyArray[0].filter?.channel).toEqual([
      Study_Channel.STABLE,
      Study_Channel.BETA,
      Study_Channel.CANARY,
    ]);
    expect(parsedStudyArray[0].filter?.platform).toEqual([
      Study_Platform.WINDOWS,
      Study_Platform.MAC,
    ]);
  });

  it('should parse study array string into an array of Study objects', () => {
    const studyArrayString = '[{"name":"Study 1"},{"name":"Study 2"}]';
    const expectedStudyArray = [
      Study.fromJson({ name: 'Study 1' }),
      Study.fromJson({ name: 'Study 2' }),
    ];

    const result = parseStudyArray(studyArrayString);
    expect(result).toEqual(expectedStudyArray);
  });

  it('should throw an error if the study is not array', () => {
    const invalidStudyArrayString = '{}';

    expect(() => parseStudyArray(invalidStudyArrayString)).toThrowError(
      'Root element must be an array',
    );
  });

  it('should throw an error if the study array string is invalid', () => {
    const invalidStudyArrayString = 'invalid';

    expect(() => parseStudyArray(invalidStudyArrayString)).toThrowError(
      'Unexpected token',
    );
  });

  it('should throw on unknown fields when parsing studies', () => {
    const studyArrayString = '[{"name":"Study 1","unknownField":"value"}]';

    expect(() => parseStudyArray(studyArrayString)).toThrowError(
      'Found unknown field while reading variations.Study from JSON format. JSON key: unknownField',
    );
  });

  it('should throw on invalid field types when parsing studies', () => {
    const studyArrayString = '[{"name":"Study 1","experiment":"value"}]';

    expect(() => parseStudyArray(studyArrayString)).toThrowError(
      'Cannot parse JSON string for variations.Study#experiment',
    );
  });

  it('should throw on invalid field types when parsing studies 2', () => {
    const studyArrayString =
      '[{"name":"Study 1","experiment":[{"probability_weight":"abc"}]}]';

    expect(() => parseStudyArray(studyArrayString)).toThrowError(
      'Cannot parse JSON string for variations.Study.Experiment#probability_weight - invalid uint 32: NaN',
    );
  });
});
