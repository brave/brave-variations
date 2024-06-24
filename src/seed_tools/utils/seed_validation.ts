// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import DefaultMap from '../../base/containers/default_map';
import { type Study_Filter } from '../../proto/generated/study';
import { type VariationsSeed } from '../../proto/generated/variations_seed';
import ProcessedStudy from './processed_study';
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
  const featureNamesToStudies = new DefaultMap<string, ProcessedStudy[]>(
    () => [],
  );
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
      featureNamesToStudies
        .get(usedFeatureName)
        .push(new ProcessedStudy(study));
    }
  }

  const filterIntersectCheckers = createStudyFilterIntersectCheckers({
    start_date: doesDateRangeIntersect,
    end_date: () => true, // Checked by start_date.
    min_version: doesVersionRangeIntersect,
    max_version: () => true, // Checked by min_version.
    min_os_version: doesVersionRangeIntersect,
    max_os_version: () => true, // Checked by min_os_version.
    channel: doesFilterArrayIntersect,
    platform: doesFilterArrayIntersect,
    locale: doesFilterArrayWithExcludesIntersect,
    exclude_locale: () => true, // Checked by locale.
    form_factor: doesFilterArrayWithExcludesIntersect,
    exclude_form_factor: () => true, // Checked by form_factor.
    hardware_class: doesFilterArrayWithExcludesIntersect,
    exclude_hardware_class: () => true, // Checked by hardware_class.
    country: doesFilterArrayWithExcludesIntersect,
    exclude_country: () => true, // Checked by country.
    is_low_end_device: doesFilterValueIntersect,
    is_enterprise: doesFilterValueIntersect,
    policy_restriction: doesFilterValueIntersect,
    cpu_architecture: doesFilterArrayWithExcludesIntersect,
    exclude_cpu_architecture: () => true, // Checked by cpu_architecture.
    google_group: doesFilterArrayWithExcludesIntersect,
    exclude_google_group: () => true, // Checked by google_group.
  });

  for (const [featureName, studies] of featureNamesToStudies.entries()) {
    for (let i = 0; i < studies.length; i++) {
      const study1 = studies[i];
      for (let j = i + 1; j < studies.length; j++) {
        const study2 = studies[j];

        // Check if any of the filters differ between the two studies.
        const hasFilterDifference = Object.keys(filterIntersectCheckers).some(
          (key) => {
            return (
              (filterIntersectCheckers as any)[key](study1, study2, key) ===
              false
            );
          },
        );

        // If there is no filter difference, the studies overlap in all
        // properties, meaning the same feature is used in both.
        if (!hasFilterDifference) {
          errors.push(
            `Feature ${featureName} overlaps in studies. Check your filters:\n${study_json_utils.stringifyStudyArray([study1.study, study2.study])}`,
          );
        }
      }
    }
  }

  return errors;
}

// Type helper to extract keys from Study_Filter that are arrays and do not have
// an "exclude_" field.
type FilterKeysWithoutExclude<T = Required<Study_Filter>> = {
  [K in keyof T]: T[K] extends any[]
    ? `exclude_${string & K}` extends keyof T
      ? never
      : K
    : never;
}[keyof T];

// Type helper to extract keys from Study_Filter that are arrays and have an
// "exclude_" field.
type FilterKeysWithExclude<T = Required<Study_Filter>> = {
  [K in keyof T]: T[K] extends any[]
    ? `exclude_${string & K}` extends keyof T
      ? K
      : never
    : never;
}[keyof T];

// Type helper to extract keys from Study_Filter that are not arrays.
type FilterKeyValues<T = Required<Study_Filter>> = {
  [K in keyof T]: T[K] extends any[] ? never : K;
}[keyof T];

// Type helper to ensure that all filters of Study_Filter structure are listed.
function createStudyFilterIntersectCheckers<
  T extends {
    [K in keyof Required<Study_Filter>]: (
      study1: ProcessedStudy,
      study2: ProcessedStudy,
      field: K,
    ) => boolean;
  },
>(checkers: T): T {
  return checkers;
}

function doesVersionRangeIntersect(
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: 'min_version' | 'min_os_version',
): boolean {
  return doesVersionFieldRangeIntersect(
    study1,
    study2,
    field === 'min_version' ? 'version_range' : 'os_version_range',
  );
}

function doesVersionFieldRangeIntersect(
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: 'version_range' | 'os_version_range',
): boolean {
  const [start1, end1] = study1[field];
  const [start2, end2] = study2[field];

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
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: 'start_date',
): boolean {
  const [start1, end1] = study1.date_range;
  const [start2, end2] = study2.date_range;

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

function doesFilterArrayIntersect<V>(
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: FilterKeysWithoutExclude,
): boolean {
  const a = study1.study.filter?.[field] as V[] | undefined;
  const b = study2.study.filter?.[field] as V[] | undefined;

  if (a === undefined || b === undefined || a.length === 0 || b.length === 0) {
    return true;
  }

  return a.some((item) => b.includes(item));
}

function doesFilterArrayWithExcludesIntersect<V>(
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: FilterKeysWithExclude,
): boolean {
  function getFilterArray(
    study: ProcessedStudy,
    field: keyof Study_Filter,
  ): V[] {
    if (study.study.filter === undefined) {
      return [];
    }
    const arrayField = study.study.filter[field];
    if (arrayField === undefined) {
      return [];
    }
    return arrayField as V[];
  }

  const study1Filter = getFilterArray(study1, field);
  const study1ExcludeFilter = getFilterArray(study1, `exclude_${field}`);
  const study2Filter = getFilterArray(study2, field);
  const study2ExcludeFilter = getFilterArray(study2, `exclude_${field}`);

  // If one of the studies has no filter, it means it applies to all values.
  if (
    (study1Filter.length === 0 && study1ExcludeFilter.length === 0) ||
    (study2Filter.length === 0 && study2ExcludeFilter.length === 0)
  ) {
    return true;
  }

  // If both studies have include filters, they intersect if at least one value
  // is in common.
  if (study1Filter.length > 0 && study2Filter.length > 0) {
    return study1Filter.some((locale) => study2Filter.includes(locale));
  }

  // If first study has an include filter and second study has an exclude
  // filter, the studies won't intersect if all include values are in the
  // exclude filter.
  if (study1Filter.length > 0 && study2ExcludeFilter.length > 0) {
    return !study1Filter.every((locale) =>
      study2ExcludeFilter.includes(locale),
    );
  }

  // Same goes for the other way around.
  if (study1ExcludeFilter.length > 0 && study2Filter.length > 0) {
    return !study2Filter.every((locale) =>
      study1ExcludeFilter.includes(locale),
    );
  }

  // If both studies have exclude filters, we assume they intersect.
  return study1ExcludeFilter.length !== 0 && study2ExcludeFilter.length !== 0;
}

function doesFilterValueIntersect<V>(
  study1: ProcessedStudy,
  study2: ProcessedStudy,
  field: FilterKeyValues,
): boolean {
  const v1 = study1.study.filter?.[field] as V | undefined;
  const v2 = study2.study.filter?.[field] as V | undefined;

  if (v1 === undefined && v2 === undefined) {
    return true;
  }

  return v1 === v2;
}
