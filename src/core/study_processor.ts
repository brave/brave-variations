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

export class StudyFilter {
  minPriority = StudyPriority.NON_INTERESTING;
  includeOutdated = false;
  showEmptyGroups = false;
  study?: string; // include studies with particular name
  search?: string; // search in study/exp/feature names
}

export class ProcessedStudy {
  study: proto.IStudy;
  studyDetails: StudyDetails;
  affectedFeatures: Set<string>;

  constructor(study: proto.IStudy, options: ProcessingOptions) {
    this.study = study;
    this.studyDetails = new StudyDetails(study, options);
    this.affectedFeatures = getAffectedFeatures(study);
    this.postProcessStudy();
  }

  getPriority(): StudyPriority {
    return this.studyDetails.getPriority();
  }

  matchesFilter(f: StudyFilter): boolean {
    if (f.study !== undefined && this.study.name !== f.study) {
      return false;
    }

    if (f.search !== undefined) {
      let found = false;
      found ||= this.study.name.search(f.search) !== -1;
      for (const e of this.study.experiment ?? [])
        found ||= e.name.search(f.search) !== -1;
      for (const feature of this.affectedFeatures)
        found ||= feature.search(f.search) !== -1;
      if (!found) return false;
    }

    if (this.getPriority() < f.minPriority) return false;
    if (this.studyDetails.isOutdated() && !f.includeOutdated) return false;
    return true;
  }

  stripEmptyFilterGroups(): void {
    this.study.experiment = this.study.experiment?.filter(
      (e) => e.probability_weight > 0,
    );
  }

  moveLargestGroupToTop(): void {
    const details = this.studyDetails;
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

export function priorityToText(p: StudyPriority): string {
  switch (p) {
    case StudyPriority.NON_INTERESTING:
      return 'non-interesting';
    case StudyPriority.BLOCKLISTED:
      return 'blocklisted';
    case StudyPriority.STABLE_MIN:
      return 'stable-min';
    case StudyPriority.STABLE_50:
      return 'stable-50%';
    case StudyPriority.STABLE_ALL:
      return 'stable-100%';
    case StudyPriority.STABLE_ALL_EMERGENCY:
      return 'stable-emergency-kill-switch';
  }
  return '';
}

export class StudyDetails {
  endedByEndDate = false;
  endedByMaxVersion = false;
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

    this.endedByMaxVersion =
      maxVersion != null &&
      !matchesMaxVersion(
        { v: [options.minMajorVersion, 0, 0, 0] },
        parseVersionPattern(maxVersion),
      );

    if (filter.end_date != null) {
      let endDateSeconds = 0;
      if (typeof filter.end_date === 'number') {
        endDateSeconds = filter.end_date;
      } else {
        // Long
        endDateSeconds = filter.end_date.toNumber();
      }

      if (
        endDateSeconds !== 0 &&
        new Date(endDateSeconds * 1000) < new Date()
      ) {
        this.endedByEndDate = true;
      }
    }

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

  getPriority(): StudyPriority {
    if (this.isBlocklisted) return StudyPriority.BLOCKLISTED;
    if (this.hasNoSupportedPlatform) return StudyPriority.NON_INTERESTING;
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

  isOutdated(): boolean {
    return this.endedByEndDate || this.endedByMaxVersion;
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