// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import DefaultMap from '../../base/containers/default_map';
import { type Study, type Study_Filter } from '../../proto/generated/study';
import { type VariationsSeed } from '../../proto/generated/variations_seed';
import * as study_filter_utils from './study_filter_utils';
import * as study_json_utils from './study_json_utils';

// Validate a seed for common errors. Throws an error if any is found.
export function validateSeed(seed: VariationsSeed) {
  const errors = validateSeedReturnErrors(seed);
  if (errors.length > 0) {
    throw new Error(`Error validating seed:\n${errors.join('\n')}`);
  }
}

// Validate a seed for common errors. Returns an array of error messages.
export function validateSeedReturnErrors(seed: VariationsSeed): string[] {
  return checkOverlappingStudies(seed);
}

// Validates a seed by checking for overlapping studies that use the same
// feature with different filters.
function checkOverlappingStudies(seed: VariationsSeed): string[] {
  const errors: string[] = [];
  // Create a map from feature name to studies that use that feature.
  const featureNamesToStudies = new DefaultMap<string, Study[]>(() => []);
  for (const study of seed.study) {
    const usedFeatureNames = new Set<string>();
    for (const experiment of study.experiment) {
      const featureAssociation = experiment.feature_association;
      if (featureAssociation !== undefined) {
        for (const enableFeature of featureAssociation.enable_feature) {
          usedFeatureNames.add(enableFeature);
        }
        for (const disableFeature of featureAssociation.disable_feature) {
          usedFeatureNames.add(disableFeature);
        }
      }
    }

    for (const usedFeatureName of usedFeatureNames) {
      featureNamesToStudies.get(usedFeatureName).push(study);
    }
  }

  // Date range cache for each study.
  const studyDateRanges = new DefaultMap<Study, study_filter_utils.DateRange>(
    study_filter_utils.getStudyDateRange,
  );

  // Version range cache for each study.
  const studyVersionRanges = new DefaultMap<
    Study,
    study_filter_utils.VersionRange
  >(study_filter_utils.getStudyVersionRange);

  // OS version range cache for each study.
  const studyOsVersionRanges = new DefaultMap<
    Study,
    study_filter_utils.VersionRange
  >(study_filter_utils.getStudyOsVersionRange);

  const filterIntersectCheckers = createStudyFilterIntersectCheckers({
    start_date: (study1: Study, study2: Study) =>
      doesDateRangeIntersect(
        studyDateRanges.get(study1),
        studyDateRanges.get(study2),
      ),
    end_date: () => true, // Handled by start_date.
    min_version: (study1: Study, study2: Study) =>
      doesVersionRangeIntersect(
        studyVersionRanges.get(study1),
        studyVersionRanges.get(study2),
      ),
    max_version: () => true, // Handled by min_version.
    min_os_version: (study1: Study, study2: Study) =>
      doesVersionRangeIntersect(
        studyOsVersionRanges.get(study1),
        studyOsVersionRanges.get(study2),
      ),
    max_os_version: () => true, // Handled by min_os_version.
    channel: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(study1.filter?.channel, study2.filter?.channel),
    platform: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.platform,
        study2.filter?.platform,
      ),
    locale: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(study1.filter?.locale, study2.filter?.locale),
    exclude_locale: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_locale,
        study2.filter?.exclude_locale,
      ),
    form_factor: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.form_factor,
        study2.filter?.form_factor,
      ),
    exclude_form_factor: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_form_factor,
        study2.filter?.exclude_form_factor,
      ),
    hardware_class: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.hardware_class,
        study2.filter?.hardware_class,
      ),
    exclude_hardware_class: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_hardware_class,
        study2.filter?.exclude_hardware_class,
      ),
    country: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(study1.filter?.country, study2.filter?.country),
    exclude_country: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_country,
        study2.filter?.exclude_country,
      ),
    is_low_end_device: (study1: Study, study2: Study) =>
      doesFilterValueIntersect(
        study1.filter?.is_low_end_device,
        study2.filter?.is_low_end_device,
      ),
    is_enterprise: (study1: Study, study2: Study) =>
      doesFilterValueIntersect(
        study1.filter?.is_enterprise,
        study2.filter?.is_enterprise,
      ),
    policy_restriction: (study1: Study, study2: Study) =>
      doesFilterValueIntersect(
        study1.filter?.policy_restriction,
        study2.filter?.policy_restriction,
      ),
    cpu_architecture: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.cpu_architecture,
        study2.filter?.cpu_architecture,
      ),
    exclude_cpu_architecture: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_cpu_architecture,
        study2.filter?.exclude_cpu_architecture,
      ),
    google_group: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.google_group,
        study2.filter?.google_group,
      ),
    exclude_google_group: (study1: Study, study2: Study) =>
      doesFilterArrayIntersect(
        study1.filter?.exclude_google_group,
        study2.filter?.exclude_google_group,
      ),
  });

  for (const [featureName, studies] of featureNamesToStudies.entries()) {
    for (let i = 0; i < studies.length; i++) {
      const study1 = studies[i];
      for (let j = i + 1; j < studies.length; j++) {
        const study2 = studies[j];

        // Check if any of the filters differ between the two studies.
        const hasFilterDifference = Object.keys(filterIntersectCheckers).some(
          (key) =>
            !filterIntersectCheckers[
              key as keyof typeof filterIntersectCheckers
            ](study1, study2),
        );

        // If there is no filter difference, the studies overlap in all
        // properties, meaning the same feature is used in both.
        if (!hasFilterDifference) {
          errors.push(
            `Feature ${featureName} overlaps in studies. Check your filters:\n${study_json_utils.stringifyStudyArray([study1, study2])}`,
          );
        }
      }
    }
  }

  return errors;
}

// Type helper to ensure that all filters of Study_Filter structure are listed.
function createStudyFilterIntersectCheckers<
  T extends {
    [K in keyof Required<Study_Filter>]: (
      study1: Study,
      study2: Study,
    ) => boolean;
  },
>(checkers: T): T {
  return checkers;
}

function doesVersionRangeIntersect(
  range1: study_filter_utils.VersionRange,
  range2: study_filter_utils.VersionRange,
): boolean {
  const [start1, end1] = range1;
  const [start2, end2] = range2;

  if (start1 !== undefined && end2 !== undefined && start1.compare(end2) > 0) {
    // Start of range1 is after end of range2, so ranges do not intersect
    return false;
  }

  if (end1 !== undefined && start2 !== undefined && end1.compare(start2) < 0) {
    // End of range1 is before start of range2, so ranges do not intersect
    return false;
  }

  // Ranges intersect
  return true;
}

function doesDateRangeIntersect(
  range1: [bigint?, bigint?],
  range2: [bigint?, bigint?],
): boolean {
  const [start1, end1] = range1;
  const [start2, end2] = range2;

  if (start1 !== undefined && end2 !== undefined && start1 > end2) {
    // Start of range1 is after end of range2, so ranges do not intersect
    return false;
  }

  if (end1 !== undefined && start2 !== undefined && end1 < start2) {
    // End of range1 is before start of range2, so ranges do not intersect
    return false;
  }

  // Ranges intersect
  return true;
}

function doesFilterArrayIntersect<V>(a?: V[], b?: V[]): boolean {
  if (a === undefined || b === undefined || a.length === 0 || b.length === 0) {
    return true;
  }

  return a.some((item) => b.includes(item));
}

function doesFilterValueIntersect<V>(v1?: V, v2?: V): boolean {
  if (v1 === undefined && v2 === undefined) {
    return true;
  }

  return v1 === v2;
}
