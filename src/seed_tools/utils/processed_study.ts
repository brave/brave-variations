// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Study } from '../../proto/generated/study';
import * as study_filter_utils from './study_filter_utils';

export default class ProcessedStudy {
  readonly study: Study;
  readonly date_range: study_filter_utils.DateRange;
  readonly version_range: study_filter_utils.VersionRange;
  readonly os_version_range: study_filter_utils.VersionRange;

  constructor(study: Study) {
    this.study = study;
    this.date_range = study_filter_utils.getStudyDateRange(study);
    this.version_range = study_filter_utils.getStudyVersionRange(study);
    this.os_version_range = study_filter_utils.getStudyOsVersionRange(study);
  }
}
