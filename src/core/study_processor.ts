// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { isFeatureBlocklisted, isStudyNameBlocklisted } from './blocklists';
import { variations as proto } from '../proto/generated/proto_bundle';
import { type ProcessingOptions } from './base_types';
import { matchesMaxVersion, parseVersionPattern } from './version';

const SUPPORTED_PLATFORMS: readonly proto.Study.Platform[] = [
  proto.Study.Platform.PLATFORM_ANDROID,
  proto.Study.Platform.PLATFORM_LINUX,
  proto.Study.Platform.PLATFORM_MAC,
  proto.Study.Platform.PLATFORM_WINDOWS,
];

export enum StudyChannelTarget {
  // filter.channel includes DEV or CANNERY, doesn't include STABLE or BETA.
  DEV_OR_CANARY,

  // filter.channel includes BETA, doesn't include STABLE
  BETA,

  // filter.channel includes STABLE
  STABLE,
}

// See the priority descriptions at https://github.com/brave/finch-data-private/
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
  search?: string; // search in study/exp/feature names

  constructor(params?: Partial<StudyFilter>) {
    Object.assign(this, params);
  }

  matches(s: ProcessedStudy): boolean {
    if (this.search !== undefined) {
      let found = false;
      found ||= s.study.name.search(this.search) !== -1;
      for (const e of s.study.experiment ?? [])
        found ||= e.name.search(this.search) !== -1;
      for (const feature of s.affectedFeatures)
        found ||= feature.search(this.search) !== -1;
      if (!found) return false;
    }

    if (s.getPriority() < this.minPriority) return false;
    if (s.studyDetails.isOutdated() && !this.includeOutdated) return false;
    return true;
  }
}

// A wrapper over a raw proto.Study that processes it and collects some extra
// data.
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
  endedByEndDate = false; // now() < end_date
  endedByMaxVersion = false; // max_version < current_stable
  isBlocklisted = false; // matches to config.js blocklists
  isEmergency = false; // matches a kill switch signature
  hasNoSupportedPlatform = false; // doesn't have any brave-supported platform
  isBadStudyFormat = false; // a bad protobuf item
  isArchived = false; // max_version <= 100.*
  hasLimitedFilter = false; // the filter limits the audience significantly.

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
      this.isBadStudyFormat = true;
      console.error('Bad study ' + JSON.stringify(study));
      return;
    }
    const isKillSwitch = (s: string) => {
      return s.match(/(K|k)ill(S|s)witch/) !== null;
    };
    this.isEmergency =
      isKillSwitch(study.name) ||
      study.experiment?.find(
        (e) => e.probability_weight > 0 && isKillSwitch(e.name),
      ) !== undefined;

    if (maxVersion != null) {
      const parsed = parseVersionPattern(maxVersion);
      if (typeof parsed[0] === 'number' && parsed[0] <= 100) {
        this.isArchived = true;
      }
      this.endedByMaxVersion = !matchesMaxVersion(
        [options.minMajorVersion, 0, 0, 0],
        parsed,
      );
    }

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

    this.hasLimitedFilter ||=
      filter?.google_group != null && filter?.google_group.length !== 0;

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
        !e.name.startsWith('Default') &&
        !e.name.startsWith('Control') &&
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
    if (
      this.maxNonDefaultWeight > this.totalWeight / 2 &&
      !this.hasLimitedFilter
    ) {
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
  return platform.filter((p) => SUPPORTED_PLATFORMS.includes(p));
}

// Processes a list of studies and groups it according to study.name.
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
