import { isFeatureBlocklisted, isStudyNameBlocklisted } from './blocklists';
import { variations as proto } from './generated/proto_bundle'
import { type ProcessingOptions } from './utils';
import { matchesMaxVersion, parseVersionPattern } from './version';

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
    this.priorityDetails = new StudyPriorityDetails(study, options)
    this.affectedFeatures = getAffectedFeatures(study)
    this.postProcessStudy()
    // TODO
  }

  getPriority(): StudyPriority {
    return this.priorityDetails.getOverallPriority();
  }

  stripEmptyFilterGroups(): void {
    this.study.experiment = this.study.experiment?.filter((e) => e.probability_weight > 0)
  }

  moveLargestGroupToTop(): void{
    if (this.priorityDetails.maxNonDefaultWeight <= this.priorityDetails.totalWeight / 2) return;
    const experiment = this.study.experiment ?? undefined;
    if (experiment === undefined) return;
    const maxExp = experiment.splice(this.priorityDetails.maxNonDefaultIndex, 1);
    this.study.experiment = maxExp.concat(experiment);
    this.priorityDetails.maxNonDefaultIndex = 0;
  }

  postProcessStudy() : void {
    this.stripEmptyFilterGroups()
    this.moveLargestGroupToTop()
    const filter = this.study.filter ?? undefined;
    if (filter !== undefined) {
      filter.platform = filterPlatforms(filter)
    }
  }
}

export function priorityToDescription(p: StudyPriority): string {
  switch (p) {
    case StudyPriority.NON_INTERESTING:
    case StudyPriority.BLOCKLISTED:
      return 'don\'t care'
    case StudyPriority.STABLE_MIN:
      return 'targets a part of the stable audience'
    case StudyPriority.STABLE_50:
      return 'targets most of the audience'
    case StudyPriority.STABLE_ALL:
      return 'targets to the all audience'
    case StudyPriority.STABLE_ALL_EMERGENCY:
      return 'makes EMERGENCY changes for the all audience'
  }
  return '';
}

// TODO: move
const kSupportedPlatforms = [
  proto.Study.Platform.PLATFORM_ANDROID,
  proto.Study.Platform.PLATFORM_LINUX,
  proto.Study.Platform.PLATFORM_MAC,
  proto.Study.Platform.PLATFORM_WINDOWS
];

export class StudyPriorityDetails {
  isOutdated = false
  isBlocklisted = false
  isEmergency = false
  hasNoSupportedPlatform = false
  totalWeight = 0

  totalNonDefaultGroupsWeight = 0
  maxNonDefaultWeight = 0
  maxNonDefaultIndex = -1
  channelTarget = StudyChannelTarget.DEV_OR_CANARY

  constructor(study: proto.IStudy, options: ProcessingOptions) {
    const filter = study.filter ?? undefined;
    const experiment = study.experiment ?? undefined;
    const maxVersion = filter?.max_version ?? undefined
    if (experiment === undefined || filter === undefined) {
      return; // TODO
    }
    this.isEmergency = study.name.match(/KillSwitch/) !== null

    this.isOutdated = maxVersion !== undefined &&
     !matchesMaxVersion({v: [options.minMajorVersion, 0, 0, 0] },
                         parseVersionPattern(maxVersion))

    this.isBlocklisted = isStudyNameBlocklisted(study.name)

    for (const e of experiment) {
      const enableFeatures = e.feature_association?.enable_feature ?? undefined
      const disabledFeatures = e.feature_association?.disable_feature ?? undefined
      this.isBlocklisted ||= enableFeatures !== undefined && enableFeatures.some(n => isFeatureBlocklisted(n))
      this.isBlocklisted ||= disabledFeatures !== undefined && disabledFeatures.some(n => isFeatureBlocklisted(n))
    }
    const filteredPlatforms = filterPlatforms(filter)
    if (filteredPlatforms === undefined || filteredPlatforms.length === 0) {
      this.hasNoSupportedPlatform = true;
    }

    let index = 0;
    for (const e of experiment) {
      const weight = e.probability_weight;
      this.totalWeight += weight;
      // TODO: add maching Control_ ?
      if (e.name.match(/Default/) === null && !areFeaturesInDefaultStates(e)) {
        this.totalNonDefaultGroupsWeight += weight
        if (weight > this.maxNonDefaultWeight) {
          this.maxNonDefaultWeight = weight;
          this.maxNonDefaultIndex = index;
        }
      }
      index++;
    }

    const channel = study.filter?.channel ?? undefined;
    if (channel !== undefined && channel.includes(proto.Study.Channel.BETA))
      this.channelTarget = StudyChannelTarget.BETA
    if (channel !== undefined && channel.includes(proto.Study.Channel.STABLE))
      this.channelTarget = StudyChannelTarget.STABLE
  }

  getOverallPriority(): StudyPriority {
    if (this.isBlocklisted)
      return StudyPriority.BLOCKLISTED
    if (this.hasNoSupportedPlatform || this.isOutdated)
      return StudyPriority.NON_INTERESTING
    if (this.channelTarget !== StudyChannelTarget.STABLE) {
      return StudyPriority.NON_INTERESTING
    }
    if (this.maxNonDefaultWeight > this.totalWeight / 2) {
      return this.isEmergency ? StudyPriority.STABLE_ALL_EMERGENCY : StudyPriority.STABLE_ALL;
    }

    if (this.totalNonDefaultGroupsWeight === 0)
      return StudyPriority.NON_INTERESTING

    if (this.totalNonDefaultGroupsWeight >= this.totalWeight / 2)
      return StudyPriority.STABLE_50;
    return StudyPriority.STABLE_MIN;
  }
}

function getAffectedFeatures(study: proto.IStudy) : Set<string> {
  const features = new Set<string>();
  const experiment = study.experiment ?? undefined;
  if (experiment === undefined) {
    return features;
  }
  for (const exp of experiment) {
    exp.feature_association?.enable_feature?.forEach(f => features.add(f))
    exp.feature_association?.disable_feature?.forEach(f => features.add(f))
  }
  return features;
}

function areFeaturesInDefaultStates(e: proto.Study.IExperiment) : boolean {
  const enableFeature = e.feature_association?.enable_feature ?? undefined;
  const disableFeature = e.feature_association?.disable_feature ?? undefined;
  if (enableFeature !== undefined && enableFeature.length > 0) return false;
  if (disableFeature !== undefined && disableFeature.length > 0) return false;
  return true;
}

function filterPlatforms(f: proto.Study.IFilter | undefined | null): proto.Study.Platform[] | undefined {
  const platform = f?.platform;
  if (platform === undefined || platform == null) return undefined;
  return platform.filter(p => kSupportedPlatforms.includes(p))
}

export function processStudyList(list: proto.IStudy[],
      minPriority: StudyPriority, options: ProcessingOptions): Map<string, ProcessedStudy[]> {
  const result = new Map<string, ProcessedStudy[]>()
  for (const study of list) {
    const name = study.name;
    const processedStudy = new ProcessedStudy(study, options);
    if (processedStudy.getPriority() < minPriority) {
      continue;
    }

    const list = result.get(name)
    if (list !== undefined)
      list.push(processedStudy)
    else
      result.set(name, [processedStudy])
  }
  return result;
}
