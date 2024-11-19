// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Study, type Study_Experiment } from '../../proto/generated/study';
import * as study_filter_utils from './study_filter_utils';
import { Version } from './version';

const allowedNameRegex = /^[0-9a-zA-Z ._-]+$/;

// Validate a study for common errors. Returns an array of error messages.
export function getStudyErrors(study: Study, fileBaseName: string): string[] {
  const errors: string[] = [];
  const validators = [
    checkName,
    checkLayers,
    checkExperiments,
    checkFilterExcludeFields,
    checkDateRange,
    checkVersionRange,
    checkOsVersionRange,
    checkChannelAndPlatform,
  ];
  for (const validator of validators) {
    try {
      errors.push(...validator(study, fileBaseName));
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
function checkName(study: Study, fileBaseName: string): string[] {
  const errors: string[] = [];
  validateName(fileBaseName, 'filename', errors);

  if (
    study.name !== fileBaseName &&
    !study.name.startsWith(`${fileBaseName}_`)
  ) {
    errors.push(
      `Study name ${study.name} does not match file name (expected ${fileBaseName} or ${fileBaseName}_<something>)`,
    );
  }
  validateName(study.name, 'study', errors);
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
    let hasForcingFeatureOn = false;
    let hasForcingFeatureOff = false;
    let hasForcingFlag = false;

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
    const featureAssociations = experiment.feature_association;
    if (featureAssociations !== undefined) {
      const featureNamesToCheck = [
        ...featureAssociations.enable_feature,
        ...featureAssociations.disable_feature,
      ];
      if (featureAssociations.forcing_feature_on !== undefined) {
        featureNamesToCheck.push(featureAssociations.forcing_feature_on);
        hasForcingFeatureOn = true;
      }
      if (featureAssociations.forcing_feature_off !== undefined) {
        featureNamesToCheck.push(featureAssociations.forcing_feature_off);
        hasForcingFeatureOff = true;
      }
      // Check featureNamesToCheck is unique.
      const featureNamesSet = new Set(featureNamesToCheck);
      if (featureNamesSet.size !== featureNamesToCheck.length) {
        const duplicateNames = featureNamesToCheck.filter(
          (name, index) => featureNamesToCheck.indexOf(name) !== index,
        );
        errors.push(
          `Duplicate feature name(s) "${duplicateNames.join(', ')}" in feature_association for experiment ${experiment.name}`,
        );
      }
      for (const featureName of featureNamesToCheck) {
        checkFeatureName(experiment, featureName, errors);
      }
    }

    // Validate forcing flag.
    if (experiment.forcing_flag !== undefined) {
      validateName(experiment.forcing_flag, 'forcing_flag', errors);
      if (
        experiment.forcing_flag === '' ||
        experiment.forcing_flag !== experiment.forcing_flag.toLowerCase()
      ) {
        errors.push(
          `Invalid forcing flag for experiment ${experiment.name}: ${experiment.forcing_flag} (expected lowercase ASCII)`,
        );
      }
      hasForcingFlag = true;
    }

    // Check either all forcing options are not set or only one of them is set.
    if (
      [hasForcingFeatureOn, hasForcingFeatureOff, hasForcingFlag].filter(
        Boolean,
      ).length > 1
    ) {
      errors.push(
        `Forcing feature_on, feature_off and flag are mutually exclusive, cannot mix them in experiment: ${experiment.name}`,
      );
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

  const checkBraveVersionFormat = (version?: Version) => {
    if (
      version !== undefined &&
      version.components.length >= 3 &&
      (version.components[0] < 80 || version.components[2] > 4000)
    ) {
      errors.push(
        `Detected non-Brave version in a filter for study ${study.name}: ${version.toString()}. Use Brave version in a format CHROMIUM_MAJOR.BRAVE_MAJOR.BRAVE_MINOR.BRAVE_BUILD`,
      );
    }
  };

  checkBraveVersionFormat(minVersion);
  checkBraveVersionFormat(maxVersion);

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

function checkChannelAndPlatform(study: Study): string[] {
  const errors: string[] = [];
  if (study.filter === undefined) {
    errors.push(`Filter is not defined for study ${study.name}.`);
    return errors;
  }

  const hasDuplicates = (a: any[]) => a.length !== new Set(a).size;

  if ((study.filter.channel?.length ?? 0) === 0) {
    errors.push(`Channel filter is required for study ${study.name}`);
  } else {
    // Check if duplicate channels are present.
    if (hasDuplicates(study.filter.channel)) {
      errors.push(`Duplicate channel(s) in filter for study ${study.name}`);
    }
  }

  if ((study.filter.platform?.length ?? 0) === 0) {
    errors.push(`Platform filter is required for study ${study.name}`);
  } else {
    // Check if duplicate platforms are present.
    if (hasDuplicates(study.filter.platform)) {
      errors.push(`Duplicate platform(s) in filter for study ${study.name}`);
    }
  }

  return errors;
}

function checkExperimentName(
  study: Study,
  experimentName: string,
  errors: string[],
) {
  if (experimentName === '') {
    errors.push(`Experiment name is not defined for study: ${study.name}`);
  }
  validateName(experimentName, 'experiment', errors);
}

function checkFeatureName(
  experiment: Study_Experiment,
  featureName: string,
  errors: string[],
) {
  if (featureName === '') {
    errors.push(
      `Feature name is not defined for experiment: ${experiment.name}`,
    );
  }
  validateName(featureName, 'feature', errors);
}

export function validateName(
  name: string,
  description: string,
  errors: string[],
) {
  if (!allowedNameRegex.test(name)) {
    errors.push(
      `Invalid ${description} name: ${name} (use only 0-9,a-z,A-Z,_,-)`,
    );
    return false;
  }
  return true;
}
