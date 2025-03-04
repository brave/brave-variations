// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import {
  Study,
  Study_Channel,
  Study_Experiment,
  Study_Filter,
  Study_Platform,
} from '../proto/generated/study';
import { type ProcessingOptions } from './base_types';
import { isFeatureBlocklisted, isStudyNameBlocklisted } from './blocklists';
import { matchesMaxVersion, parseVersionPattern } from './version';

const UPSTREAM_SUPPORTED_PLATFORMS: readonly Study_Platform[] = [
  Study_Platform.ANDROID,
  Study_Platform.LINUX,
  Study_Platform.MAC,
  Study_Platform.WINDOWS,
];

const BRAVE_SUPPORTED_PLATFORMS: readonly Study_Platform[] =
  UPSTREAM_SUPPORTED_PLATFORMS.concat([Study_Platform.IOS]);

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
  STABLE_EMERGENCY_KILL_SWITCH,
}

export class StudyFilter {
  minPriority = StudyPriority.NON_INTERESTING;
  includeOutdated = false;
  showEmptyGroups = false;
  private _search?: string; // search in study/exp/feature names
  private _searchRegexp?: RegExp;

  constructor(params?: Partial<StudyFilter>) {
    Object.assign(this, params);
  }

  get search(): string | undefined {
    return this._search;
  }

  set search(value: string | undefined) {
    this._search = value;
    const sanitizedValue = value?.replaceAll(/\W/g, '');
    this._searchRegexp =
      value !== undefined ? new RegExp(`(${sanitizedValue})`, 'gi') : undefined;
  }

  get searchRegexp() {
    return this._searchRegexp;
  }

  matches(s: ProcessedStudy): boolean {
    if (s.getPriority() < this.minPriority) return false;
    if (s.studyDetails.isOutdated() && !this.includeOutdated) return false;
    const regex = this.searchRegexp;
    if (regex !== undefined) {
      let found = false;
      found ||= regex.test(s.study.name);
      for (const e of s.study.experiment ?? []) {
        found ||= regex.test(e.name);
        for (const p of e.param ?? []) {
          if (p.name != null) found ||= regex.test(p.name);
          if (p.value != null) found ||= regex.test(p.value);
        }
      }
      for (const feature of s.affectedFeatures) found ||= regex.test(feature);
      if (!found) return false;
    }

    return true;
  }
}

// A wrapper over a raw Study that processes it and collects some extra
// data.
export class ProcessedStudy {
  study: Study;
  studyDetails: StudyDetails;
  affectedFeatures: Set<string>;

  constructor(study: Study, options: ProcessingOptions) {
    this.study = study;
    this.studyDetails = new StudyDetails(study, options);
    this.affectedFeatures = getAffectedFeatures(study);
    this.postProcessStudy(options);
  }

  equals(other: ProcessedStudy): boolean {
    const jsonEquals = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);

    return (
      Study.equals(this.study, other.study) &&
      jsonEquals(this.studyDetails, other.studyDetails) &&
      jsonEquals(this.affectedFeatures, other.affectedFeatures)
    );
  }

  getPriority(): StudyPriority {
    return this.studyDetails.getPriority();
  }

  stripEmptyFilterGroups(): void {
    this.study.experiment = this.study.experiment?.filter(
      (e) => (e.probability_weight ?? 0) > 0,
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

  postProcessStudy(options: ProcessingOptions): void {
    this.study.filter?.channel?.sort();
    this.study.filter?.platform?.sort();
    this.study.filter?.country?.sort();
    this.study.filter?.locale?.sort();
    const filter = this.study.filter;
    if (filter != null) {
      filter.platform = filterPlatforms(filter, options.isBraveSeed);
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
    case StudyPriority.STABLE_EMERGENCY_KILL_SWITCH:
      return 'stable-emergency-kill-switch';
  }
  return '';
}

export class StudyDetails {
  endedByEndDate = false; // now() < end_date
  endedByMaxVersion = false; // max_version < current_stable
  isBlocklisted = false; // matches to config.js blocklists
  isKillSwitch = false; // matches a kill switch signature
  hasNoSupportedPlatform = false; // doesn't have any brave-supported platform
  isBadStudyFormat = false; // a bad protobuf item
  isArchived = false; // max_version <= 100.*
  hasLimitedFilter = false; // the filter limits the audience significantly.
  onlyDisabledFeatures = true;

  totalWeight = 0;
  totalNonDefaultGroupsWeight = 0;
  maxNonDefaultWeight = 0;
  maxNonDefaultIndex = -1;
  channelTarget = StudyChannelTarget.DEV_OR_CANARY;

  constructor(study: Study, options: ProcessingOptions) {
    const filter = study.filter;
    const experiment = study.experiment;
    const maxVersion = filter?.max_version;
    if (experiment == null || filter == null) {
      this.isBadStudyFormat = true;
      console.error('Bad study ' + JSON.stringify(study));
      return;
    }
    const isKillSwitch = (s: string) => {
      return /(K|k)ill(S|s)witch/.test(s);
    };

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
        endDateSeconds = Number(filter.end_date);
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

    this.isKillSwitch = isKillSwitch(study.name);
    for (const e of experiment) {
      const enableFeatures = e.feature_association?.enable_feature;
      const disabledFeatures = e.feature_association?.disable_feature;
      this.isBlocklisted ||=
        enableFeatures?.some((n) => isFeatureBlocklisted(n)) ?? false;
      this.isBlocklisted ||=
        disabledFeatures?.some((n) => isFeatureBlocklisted(n)) ?? false;

      this.isKillSwitch ||=
        (e.probability_weight ?? 0) > 0 && isKillSwitch(e.name);

      this.onlyDisabledFeatures &&=
        e.probability_weight === 0 ||
        e.feature_association?.enable_feature == null ||
        e.feature_association?.enable_feature.length === 0;
    }

    const filteredPlatforms = filterPlatforms(filter, options.isBraveSeed);
    if (filteredPlatforms === undefined || filteredPlatforms.length === 0) {
      this.hasNoSupportedPlatform = true;
    }

    let index = 0;
    for (const e of experiment) {
      const weight = e.probability_weight ?? 0;
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
    if (channel?.includes(Study_Channel.BETA))
      this.channelTarget = StudyChannelTarget.BETA;
    if (channel?.includes(Study_Channel.STABLE))
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
      return this.isKillSwitch
        ? StudyPriority.STABLE_EMERGENCY_KILL_SWITCH
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

function getAffectedFeatures(study: Study): Set<string> {
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

function areFeaturesInDefaultStates(e: Study_Experiment): boolean {
  const enableFeature = e.feature_association?.enable_feature;
  const disableFeature = e.feature_association?.disable_feature;
  if (enableFeature != null && enableFeature.length > 0) return false;
  if (disableFeature != null && disableFeature.length > 0) return false;
  return true;
}

function filterPlatforms(
  f: Study_Filter,
  isBraveSeed: boolean,
): Study_Platform[] {
  const platform = f?.platform;
  const supportedPlatforms = isBraveSeed
    ? BRAVE_SUPPORTED_PLATFORMS
    : UPSTREAM_SUPPORTED_PLATFORMS;
  return platform.filter((p) => supportedPlatforms.includes(p));
}

// Processes a list of studies and groups it according to study.name.
export function processStudyList(
  list: Study[],
  minPriority: StudyPriority,
  options: ProcessingOptions,
): Map<string, ProcessedStudy[]> {
  const result = new Map<string, ProcessedStudy[]>();
  for (const study of list) {
    const name = study.name;
    const processedStudy = new ProcessedStudy(study, options);
    if (
      processedStudy.getPriority() < minPriority ||
      processedStudy.studyDetails.isOutdated()
    ) {
      continue;
    }

    const list = result.get(name);
    if (list !== undefined) list.push(processedStudy);
    else result.set(name, [processedStudy]);
  }
  return result;
}
