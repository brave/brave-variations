// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import path from 'path';
import { type Study, type Study_Experiment } from '../../proto/generated/study';
import * as study_filter_utils from './study_filter_utils';

const invalidFeatureOrFieldTrialNameChars = ',<*';
const invalidExperimentNameChars = '<*';

// Validate a study for common errors. Throws an error if any is found.
export function validateStudy(study: Study, studyFilePath: string) {
  const errors = validateStudyReturnErrors(study, studyFilePath);
  if (errors.length > 0) {
    throw new Error(`Error validating ${studyFilePath}:\n${errors.join('\n')}`);
  }
}

// Validate a study for common errors. Returns an array of error messages.
export function validateStudyReturnErrors(
  study: Study,
  studyFilePath: string,
): string[] {
  const errors: string[] = [];
  const validators = [
    checkName,
    checkLayers,
    checkExperiments,
    checkFilterExcludeFields,
    checkDateRange,
    checkVersionRange,
    checkOsVersionRange,
  ];
  for (const validator of validators) {
    try {
      errors.push(...validator(study, studyFilePath));
    } catch (e) {
      if (e instanceof Error) {
        errors.push(e.message);
      } else {
        // Rethrow non-Error exceptions.
        throw e;
      }
    }
  }
  return errors;
}

// Check that study name matches the file name.
function checkName(study: Study, studyFilePath: string): string[] {
  const errors: string[] = [];
  const fileBaseName = path.basename(studyFilePath, '.json');
  if (
    study.name !== fileBaseName &&
    !study.name.startsWith(`${fileBaseName}_`)
  ) {
    errors.push(
      `Study name ${study.name} does not match file name (expected ${fileBaseName} or ${fileBaseName}_<something>)`,
    );
  }
  if (
    !isStringASCIIWithoutChars(study.name, invalidFeatureOrFieldTrialNameChars)
  ) {
    errors.push(
      `Invalid study name: ${study.name} (expected ASCII without "${invalidFeatureOrFieldTrialNameChars}" chars)`,
    );
  }
  return errors;
}

function checkLayers(study: Study): string[] {
  const errors: string[] = [];
  if (study.layer !== undefined) {
    errors.push('Layers are currently not supported');
  }
  return errors;
}

// Check that experiment names are unique and total probability is 100.
function checkExperiments(study: Study): string[] {
  const errors: string[] = [];
  const experimentNames = new Set<string>();
  let totalProbability = 0;
  for (const experiment of study.experiment) {
    // Validate experiment name.
    checkExperimentName(study, experiment.name, errors);
    if (experimentNames.has(experiment.name)) {
      errors.push(`Duplicate experiment name: ${experiment.name}`);
    }
    // Validate probability_weight.
    if (experiment.probability_weight === undefined) {
      errors.push(
        `probability_weight is not defined for experiment ${experiment.name}`,
      );
    }
    experimentNames.add(experiment.name);
    totalProbability += experiment.probability_weight ?? 0;

    // Validate features.
    if (experiment.feature_association !== undefined) {
      const featureNamesToCheck = [
        ...experiment.feature_association.enable_feature,
        ...experiment.feature_association.disable_feature,
        experiment.feature_association.forcing_feature_on,
        experiment.feature_association.forcing_feature_off,
      ];
      for (const featureName of featureNamesToCheck) {
        if (featureName !== undefined) {
          checkFeatureName(experiment, featureName, errors);
        }
      }
    }

    // Validate forcing flag.
    if (experiment.forcing_flag !== undefined) {
      if (
        experiment.forcing_flag === '' ||
        !isStringASCIIWithoutChars(experiment.forcing_flag, '') ||
        experiment.forcing_flag !== experiment.forcing_flag.toLowerCase()
      ) {
        errors.push(
          `Invalid forcing flag for experiment ${experiment.name}: ${experiment.forcing_flag} (expected lowercase ASCII)`,
        );
      }
    }

    // Validate google_web_experiment_id and google_web_trigger_experiment_id.
    if (
      experiment.google_web_experiment_id !== undefined &&
      experiment.google_web_trigger_experiment_id !== undefined
    ) {
      errors.push(
        `Experiment ${experiment.name} has both google_web_experiment_id and web_trigger_experiment_id`,
      );
    }

    // Valiate params.
    const paramNames = new Set<string>();
    if (experiment.param.length > 0) {
      for (const param of experiment.param) {
        if (param.name === undefined || param.name === '') {
          errors.push(`Empty param name in experiment ${experiment.name}`);
          continue;
        }
        if (paramNames.has(param.name)) {
          errors.push(
            `Duplicate param name: ${param.name} in experiment ${experiment.name}`,
          );
        }
        paramNames.add(param.name);
      }
    }
  }

  // Validate default_experiment_name.
  if (
    study.default_experiment_name !== undefined &&
    study.default_experiment_name !== '' &&
    !experimentNames.has(study.default_experiment_name)
  ) {
    errors.push(
      `Missing default experiment: ${study.default_experiment_name} in ${study.name} study`,
    );
  }

  // Validate total probability.
  if (totalProbability !== 100) {
    errors.push(`Total probability is not 100 for study ${study.name}`);
  }

  return errors;
}

// Check that exclude_ fields are not set if the corresponding fields are set.
function checkFilterExcludeFields(study: Study): string[] {
  const errors: string[] = [];
  if (study.filter === undefined) {
    return errors;
  }

  for (const key of Object.keys(study.filter)) {
    if (!key.startsWith('exclude_')) {
      continue;
    }
    const nonExcludeKey = key.slice(8);
    const filterAsAny = study.filter as Record<string, any>;
    const isNonEmptyArray = (key: string) =>
      Array.isArray(filterAsAny[key]) && filterAsAny[key].length > 0;
    if (isNonEmptyArray(key) && isNonEmptyArray(nonExcludeKey)) {
      // Both property and its 'exclude_' counterpart are set.
      errors.push(
        `Filter conflict: ${key} and ${nonExcludeKey} cannot be set at the same time for study ${study.name}`,
      );
    }
  }
  return errors;
}

// Check that date range is valid.
function checkDateRange(study: Study): string[] {
  const errors: string[] = [];
  const [startDate, endDate] = study_filter_utils.getStudyDateRange(study);

  if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
    errors.push(
      `Invalid date range for study ${study.name}: start (${startDate}) > end (${endDate})`,
    );
  }
  return errors;
}

// Check that version range is valid.
function checkVersionRange(study: Study): string[] {
  const errors: string[] = [];
  const [minVersion, maxVersion] =
    study_filter_utils.getStudyVersionRange(study);

  if (
    minVersion !== undefined &&
    maxVersion !== undefined &&
    minVersion.gt(maxVersion)
  ) {
    errors.push(
      `Invalid version range for study ${study.name}: min (${minVersion.toString()}) > max (${maxVersion.toString()})`,
    );
  }
  return errors;
}

// Check that os_version range is valid.
function checkOsVersionRange(study: Study): string[] {
  const errors: string[] = [];
  const [minOsVersion, maxOsVersion] =
    study_filter_utils.getStudyOsVersionRange(study);

  if (
    minOsVersion !== undefined &&
    maxOsVersion !== undefined &&
    minOsVersion.gt(maxOsVersion)
  ) {
    errors.push(
      `Invalid os_version range for study ${study.name}: min (${minOsVersion.toString()}) > max (${maxOsVersion.toString()})`,
    );
  }
  return errors;
}

function checkExperimentName(
  study: Study,
  experimentName: string,
  errors: string[],
) {
  if (experimentName === '') {
    errors.push(`Experiment name is not defined for study ${study.name}`);
  }
  if (!isStringASCIIWithoutChars(experimentName, invalidExperimentNameChars)) {
    errors.push(
      `Invalid experiment name: ${experimentName} (expected ASCII without "${invalidExperimentNameChars}" chars)`,
    );
  }
}

function checkFeatureName(
  experiment: Study_Experiment,
  featureName: string,
  errors: string[],
) {
  if (
    !isStringASCIIWithoutChars(featureName, invalidFeatureOrFieldTrialNameChars)
  ) {
    errors.push(
      `Invalid feature name for experiment ${experiment.name}: ${featureName} (expected ASCII without "${invalidFeatureOrFieldTrialNameChars}" chars)`,
    );
  }
}

function isStringASCIIWithoutChars(
  str: string,
  charsToExclude: string,
): boolean {
  // Check if every character in the string is within the ASCII range (0-127).
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return false;
    }
    if (charsToExclude !== '' && charsToExclude.includes(str[i])) {
      return false;
    }
  }
  return true;
}
