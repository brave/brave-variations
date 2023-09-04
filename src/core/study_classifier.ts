// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { isFeatureBlocklisted, isStudyNameBlocklisted } from './blocklists';
import { variations as proto } from '../proto/generated/proto_bundle';
import { type ProcessingOptions } from './core_utils';
import { matchesMaxVersion, parseVersionPattern } from './version';

const kSupportedPlatforms = [
  proto.Study.Platform.PLATFORM_ANDROID,
  proto.Study.Platform.PLATFORM_LINUX,
  proto.Study.Platform.PLATFORM_MAC,
  proto.Study.Platform.PLATFORM_WINDOWS,
];

export enum StudyChannelTarget {
  DEV_OR_CANARY,
  BETA,
  STABLE,
}

export enum StudyPriority {
  NON_INTERESTING,
  BLOCKLISTED,
  STABLE_MIN,
  STABLE_50,
  STABLE_ALL,
  STABLE_ALL_EMERGENCY,
}

export class ProcessedStudy {
  study: proto.IStudy;
  priorityDetails: StudyPriorityDetails;
  affectedFeatures: Set<string>;

  constructor(study: proto.IStudy, options: ProcessingOptions) {
    this.study = study;
    this.priorityDetails = new StudyPriorityDetails(study, options);
    this.affectedFeatures = getAffectedFeatures(study);
    this.postProcessStudy();
  }

  getPriority(): StudyPriority {
    return this.priorityDetails.getOverallPriority();
  }

  stripEmptyFilterGroups(): void {
    this.study.experiment = this.study.experiment?.filter(
      (e) => e.probability_weight > 0,
    );
  }

  moveLargestGroupToTop(): void {
    const details = this.priorityDetails;
    if (details.maxNonDefaultWeight <= details.totalWeight / 2) return;
    const experiment = this.study.experiment;
    if (experiment == null) return;
    const maxExp = experiment.splice(details.maxNonDefaultIndex, 1);
    this.study.experiment = maxExp.concat(experiment);
    details.maxNonDefaultIndex = 0;
  }

  postProcessStudy(): void {
    this.study.filter?.channel?.sort();
    this.study.filter?.platform?.sort();
    this.study.filter?.country?.sort();
    this.study.filter?.locale?.sort();
    const filter = this.study.filter;
    if (filter != null) {
      filter.platform = filterPlatforms(filter);
    }
  }

  postProcessBeforeSerialization(): void {
    this.moveLargestGroupToTop();
    this.stripEmptyFilterGroups();
  }
}

export function priorityToDescription(p: StudyPriority): string {
  switch (p) {
    case StudyPriority.NON_INTERESTING:
    case StudyPriority.BLOCKLISTED:
      return "don't care";
    case StudyPriority.STABLE_MIN:
      return 'targets a part of the stable audience';
    case StudyPriority.STABLE_50:
      return 'targets most of the audience';
    case StudyPriority.STABLE_ALL:
      return 'targets to the all audience';
    case StudyPriority.STABLE_ALL_EMERGENCY:
      return 'makes EMERGENCY changes for the all audience';
  }
  return '';
}

export class StudyPriorityDetails {
  isOutdated = false;
  isBlocklisted = false;
  isEmergency = false;
  hasNoSupportedPlatform = false;
  totalWeight = 0;

  totalNonDefaultGroupsWeight = 0;
  maxNonDefaultWeight = 0;
  maxNonDefaultIndex = -1;
  channelTarget = StudyChannelTarget.DEV_OR_CANARY;

  constructor(study: proto.IStudy, options: ProcessingOptions) {
    const filter = study.filter;
    const experiment = study.experiment;
    const maxVersion = filter?.max_version;
    if (experiment == null || filter == null) {
      console.error('Bad study', JSON.stringify(study));
      return;
    }
    this.isEmergency = study.name.match(/KillSwitch/) !== null;

    this.isOutdated =
      maxVersion != null &&
      !matchesMaxVersion(
        { v: [options.minMajorVersion, 0, 0, 0] },
        parseVersionPattern(maxVersion),
      );

    this.isBlocklisted = isStudyNameBlocklisted(study.name);

    for (const e of experiment) {
      const enableFeatures = e.feature_association?.enable_feature;
      const disabledFeatures = e.feature_association?.disable_feature;
      this.isBlocklisted ||=
        enableFeatures != null &&
        enableFeatures.some((n) => isFeatureBlocklisted(n));
      this.isBlocklisted ||=
        disabledFeatures != null &&
        disabledFeatures.some((n) => isFeatureBlocklisted(n));
    }
    const filteredPlatforms = filterPlatforms(filter);
    if (filteredPlatforms === undefined || filteredPlatforms.length === 0) {
      this.hasNoSupportedPlatform = true;
    }

    let index = 0;
    for (const e of experiment) {
      const weight = e.probability_weight;
      this.totalWeight += weight;
      if (
        e.name.match(/Default|Control_/) == null &&
        !areFeaturesInDefaultStates(e)
      ) {
        this.totalNonDefaultGroupsWeight += weight;
        if (weight > this.maxNonDefaultWeight) {
          this.maxNonDefaultWeight = weight;
          this.maxNonDefaultIndex = index;
        }
      }
      index++;
    }

    const channel = study.filter?.channel;
    if (channel != null && channel.includes(proto.Study.Channel.BETA))
      this.channelTarget = StudyChannelTarget.BETA;
    if (channel != null && channel.includes(proto.Study.Channel.STABLE))
      this.channelTarget = StudyChannelTarget.STABLE;
  }

  getOverallPriority(): StudyPriority {
    if (this.isBlocklisted) return StudyPriority.BLOCKLISTED;
    if (this.hasNoSupportedPlatform || this.isOutdated)
      return StudyPriority.NON_INTERESTING;
    if (this.channelTarget !== StudyChannelTarget.STABLE) {
      return StudyPriority.NON_INTERESTING;
    }
    if (this.maxNonDefaultWeight > this.totalWeight / 2) {
      return this.isEmergency
        ? StudyPriority.STABLE_ALL_EMERGENCY
        : StudyPriority.STABLE_ALL;
    }

    if (this.totalNonDefaultGroupsWeight === 0)
      return StudyPriority.NON_INTERESTING;

    if (this.totalNonDefaultGroupsWeight >= this.totalWeight / 2)
      return StudyPriority.STABLE_50;
    return StudyPriority.STABLE_MIN;
  }
}

function getAffectedFeatures(study: proto.IStudy): Set<string> {
  const features = new Set<string>();
  const experiment = study.experiment;
  if (experiment == null) {
    return features;
  }
  for (const exp of experiment) {
    exp.feature_association?.enable_feature?.forEach((f) => features.add(f));
    exp.feature_association?.disable_feature?.forEach((f) => features.add(f));
  }
  return features;
}

function areFeaturesInDefaultStates(e: proto.Study.IExperiment): boolean {
  const enableFeature = e.feature_association?.enable_feature;
  const disableFeature = e.feature_association?.disable_feature;
  if (enableFeature != null && enableFeature.length > 0) return false;
  if (disableFeature != null && disableFeature.length > 0) return false;
  return true;
}

function filterPlatforms(
  f: proto.Study.IFilter | undefined | null,
): proto.Study.Platform[] | undefined {
  const platform = f?.platform;
  if (platform == null) return undefined;
  return platform.filter((p) => kSupportedPlatforms.includes(p));
}

export function processStudyList(
  list: proto.IStudy[],
  minPriority: StudyPriority,
  options: ProcessingOptions,
): Map<string, ProcessedStudy[]> {
  const result = new Map<string, ProcessedStudy[]>();
  for (const study of list) {
    const name = study.name;
    const processedStudy = new ProcessedStudy(study, options);
    if (processedStudy.getPriority() < minPriority) {
      continue;
    }

    const list = result.get(name);
    if (list !== undefined) list.push(processedStudy);
    else result.set(name, [processedStudy]);
  }
  return result;
}
