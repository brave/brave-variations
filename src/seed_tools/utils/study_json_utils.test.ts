// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import JSON5 from 'json5';
import {
  Study,
  Study_Channel,
  Study_Platform,
} from '../../proto/generated/study';
import { parseStudies, stringifyStudies } from './study_json_utils';

describe('stringifyStudies', () => {
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

    const stringifiedStudyArray = stringifyStudies([study]);
    expect(JSON5.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'study',
        filter: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
      },
    ]);
  });

  it('should convert channel, platform values', () => {
    const study = Study.fromJson(
      {
        name: 'study',
        filter: {
          channel: ['CANARY', 'BETA', 'STABLE'],
          platform: ['PLATFORM_LINUX', 'PLATFORM_MAC'],
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudies([study]);
    expect(JSON5.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'study',
        filter: {
          channel: ['NIGHTLY', 'BETA', 'RELEASE'],
          platform: ['LINUX', 'MAC'],
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
          platform: ['WINDOWS', 'MAC'],
          channel: ['CANARY', 'BETA', 'STABLE'],
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudies([study]);
    expect(JSON5.parse(stringifiedStudyArray)).toEqual([
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
          platform: ['WINDOWS', 'MAC'],
        },
      },
    ]);
  });

  it('chromium mode should use chromium channel names', () => {
    const startDate = new Date('2022-01-01T00:00:00Z');
    const study = Study.fromJson(
      {
        name: 'study',
        filter: {
          start_date: Math.floor(startDate.getTime() / 1000),
          channel: ['CANARY', 'BETA', 'STABLE'],
          platform: ['LINUX', 'MAC'],
        },
      },
      { ignoreUnknownFields: false },
    );

    const stringifiedStudyArray = stringifyStudies([study], {
      isChromium: true,
    });
    expect(JSON5.parse(stringifiedStudyArray)).toEqual([
      {
        name: 'study',
        filter: {
          start_date: startDate.toISOString(),
          channel: ['CANARY', 'BETA', 'STABLE'],
          platform: ['LINUX', 'MAC'],
        },
      },
    ]);
  });
});

describe('parseStudies', () => {
  it('should convert ISO string start_date and end_date to Unix timestamp', () => {
    const startDate = '2022-01-01T00:00:00.000Z';
    const endDate = '2022-12-31T23:59:59.999Z';

    const study = JSON5.stringify([
      {
        name: 'study',
        filter: {
          start_date: startDate,
          end_date: endDate,
        },
      },
    ]);

    const parsedStudyArray = parseStudies(study);
    expect(parsedStudyArray[0].filter?.start_date).toEqual(
      BigInt(Math.floor(new Date(startDate).getTime() / 1000)),
    );
    expect(parsedStudyArray[0].filter?.end_date).toEqual(
      BigInt(Math.floor(new Date(endDate).getTime() / 1000)),
    );
  });

  it('should throw an error for invalid start_date or end_date format', () => {
    const parseStudyWithFilter = (filter: any) => {
      return parseStudies(
        JSON5.stringify([
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
    const study = JSON5.stringify([
      {
        name: 'study',
        filter: {
          channel: ['NIGHTLY', 'BETA', 'RELEASE'],
        },
      },
    ]);

    const parsedStudyArray = parseStudies(study);
    expect(parsedStudyArray[0].filter?.channel).toEqual([
      Study_Channel.CANARY,
      Study_Channel.BETA,
      Study_Channel.STABLE,
    ]);
  });

  it('should not modify other keys', () => {
    const study = JSON5.stringify([
      {
        name: 'study',
        filter: {
          channel: ['RELEASE', 'BETA', 'NIGHTLY'],
          platform: ['WINDOWS', 'MAC'],
        },
      },
    ]);

    const parsedStudyArray = parseStudies(study);
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

    const result = parseStudies(studyArrayString);
    expect(result).toEqual(expectedStudyArray);
  });

  it('should throw an error if the study is not array', () => {
    const invalidStudyArrayString = '{}';

    expect(() => parseStudies(invalidStudyArrayString)).toThrowError(
      'Root element must be an array',
    );
  });

  it('should throw an error if the study array string is invalid', () => {
    const invalidStudyArrayString = 'invalid';

    expect(() => parseStudies(invalidStudyArrayString)).toThrowError(
      'invalid character',
    );
  });

  it('should throw on unknown fields when parsing studies', () => {
    const studyArrayString = '[{"name":"Study 1","unknownField":"value"}]';

    expect(() => parseStudies(studyArrayString)).toThrowError(
      'Found unknown field while reading variations.Study from JSON format. JSON key: unknownField',
    );
  });

  it('should throw on invalid field types when parsing studies', () => {
    const studyArrayString = '[{"name":"Study 1","experiment":"value"}]';

    expect(() => parseStudies(studyArrayString)).toThrowError(
      'Cannot parse JSON string for variations.Study#experiment',
    );
  });

  it('should throw on invalid field types when parsing studies 2', () => {
    const studyArrayString =
      '[{"name":"Study 1","experiment":[{"probability_weight":"abc"}]}]';

    expect(() => parseStudies(studyArrayString)).toThrowError(
      'Cannot parse JSON string for variations.Study.Experiment#probability_weight - invalid uint 32: NaN',
    );
  });

  it('chromium mode should keep channel values', () => {
    const study = JSON5.stringify([
      {
        name: 'study',
        filter: {
          channel: ['CANARY', 'BETA', 'STABLE'],
        },
      },
    ]);

    const parsedStudyArray = parseStudies(study, { isChromium: true });
    expect(parsedStudyArray[0].filter?.channel).toEqual([
      Study_Channel.CANARY,
      Study_Channel.BETA,
      Study_Channel.STABLE,
    ]);
  });
});
