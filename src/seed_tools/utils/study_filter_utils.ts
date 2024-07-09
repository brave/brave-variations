// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Study } from '../../proto/generated/study';
import { Version, type VersionOptions } from './version';

export type VersionRange = [Version?, Version?];
export type DateRange = [bigint?, bigint?];

export function getStudyDateRange(study: Study): DateRange {
  return [study.filter?.start_date, study.filter?.end_date];
}

export function getStudyVersionRange(study: Study): VersionRange {
  const options = { disallowLeadingZeros: true };
  return [
    maybeCreateVersion(study.filter?.min_version, options),
    maybeCreateVersion(study.filter?.max_version, options),
  ];
}

export function getStudyOsVersionRange(study: Study): VersionRange {
  const options = { disallowLeadingZeros: true };
  return [
    maybeCreateVersion(study.filter?.min_os_version, options),
    maybeCreateVersion(study.filter?.max_os_version, options),
  ];
}

function maybeCreateVersion(
  version: string | undefined,
  options?: VersionOptions,
): Version | undefined {
  return version !== undefined ? new Version(version, options) : undefined;
}
