// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Study } from '../../proto/generated/study';
import * as study_filter_utils from './study_filter_utils';
import { Version } from './version';

describe('getStudyDateRange', () => {
  it('should return the date range from start_date to end_date', () => {
    const study = Study.fromJson({
      filter: {
        start_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
        end_date: Math.floor(new Date('2022-12-31').getTime() / 1000),
      },
    });

    const result = study_filter_utils.getStudyDateRange(study);

    assert.deepStrictEqual(result, [
      BigInt(Math.floor(new Date('2022-01-01').getTime() / 1000)),
      BigInt(Math.floor(new Date('2022-12-31').getTime() / 1000)),
    ]);
  });

  it('should return undefined for missing start_date or end_date', () => {
    const study = Study.fromJson({
      filter: {
        start_date: Math.floor(new Date('2022-01-01').getTime() / 1000),
      },
    });

    const result = study_filter_utils.getStudyDateRange(study);

    assert.deepStrictEqual(result, [
      BigInt(Math.floor(new Date('2022-01-01').getTime() / 1000)),
      undefined,
    ]);
  });

  it('should return undefined for undefined start_date and end_date', () => {
    const study = Study.fromJson({
      filter: {},
    });

    const result = study_filter_utils.getStudyDateRange(study);

    assert.deepStrictEqual(result, [undefined, undefined]);
  });
});

describe('getStudyVersionRange', () => {
  it('should return the version range from min_version to max_version', () => {
    const study = Study.fromJson({
      filter: {
        min_version: '1.0.0',
        max_version: '2.0.0',
      },
    });

    const result = study_filter_utils.getStudyVersionRange(study);

    assert.deepStrictEqual(result, [
      new Version('1.0.0'),
      new Version('2.0.0'),
    ]);
  });

  it('should return undefined for missing min_version or max_version', () => {
    const study = Study.fromJson({
      filter: {
        min_version: '1.0.0',
      },
    });

    const result = study_filter_utils.getStudyVersionRange(study);

    assert.deepStrictEqual(result, [new Version('1.0.0'), undefined]);
  });

  it('should return undefined for undefined min_version and max_version', () => {
    const study = Study.fromJson({
      filter: {},
    });

    const result = study_filter_utils.getStudyVersionRange(study);

    assert.deepStrictEqual(result, [undefined, undefined]);
  });
});

describe('getStudyOsVersionRange', () => {
  it('should return the version range from min_os_version to max_os_version', () => {
    const study = Study.fromJson({
      filter: {
        min_os_version: '10.0.0',
        max_os_version: '11.0.0',
      },
    });

    const result = study_filter_utils.getStudyOsVersionRange(study);

    assert.deepStrictEqual(result, [
      new Version('10.0.0'),
      new Version('11.0.0'),
    ]);
  });

  it('should return undefined for missing min_os_version or max_os_version', () => {
    const study = Study.fromJson({
      filter: {
        min_os_version: '10.0.0',
      },
    });

    const result = study_filter_utils.getStudyOsVersionRange(study);

    assert.deepStrictEqual(result, [new Version('10.0.0'), undefined]);
  });

  it('should return undefined for undefined min_os_version and max_os_version', () => {
    const study = Study.fromJson({
      filter: {},
    });

    const result = study_filter_utils.getStudyOsVersionRange(study);

    assert.deepStrictEqual(result, [undefined, undefined]);
  });
});
