// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type variations as proto } from '../../proto/generated/proto_bundle';
import {
  ProcessedStudy,
  type StudyFilter,
  type StudyPriority,
} from '../../core/study_processor';
import {
  getChannelName,
  getPlatfromName,
  getFeatureSearchUrl,
  type ProcessingOptions,
} from '../../core/core_utils';

export enum SeedType {
  PRODUCTION,
  STAGING,
  UPSTREAM,
}

export function stringToSeedType(value: string): SeedType | undefined {
  const index = Object.values(SeedType).indexOf(value);
  if (index >= 0) {
    return index as SeedType;
  }
  return undefined;
}

export class FeatureModel {
  name: string;
  link: string;
}

export class ExperimentModel {
  private readonly experiment: proto.Study.IExperiment;
  private readonly studyModel: StudyModel;

  constructor(experiment: proto.Study.IExperiment, studyModel: StudyModel) {
    this.experiment = experiment;
    this.studyModel = studyModel;
  }

  getFeatures(features?: string[] | null): FeatureModel[] {
    if (features == null) {
      return [];
    }
    return features.map((f) => {
      return {
        name: f,
        link: getFeatureSearchUrl(f),
      };
    });
  }

  enabledFeatures(): FeatureModel[] {
    return this.getFeatures(
      this.experiment.feature_association?.enable_feature,
    );
  }

  disabledFeatures(): FeatureModel[] {
    return this.getFeatures(
      this.experiment.feature_association?.disable_feature,
    );
  }

  parameters(): string[] {
    const param = this.experiment.param;
    if (param == null) return [];
    return param.map((p) => p.name + ': ' + p.value);
  }

  name(): string {
    return this.experiment.name;
  }

  weight(): number {
    const totalWeight = this.studyModel.processedStudy.studyDetails.totalWeight;
    if (totalWeight === 0) return 0;
    return (this.experiment.probability_weight / totalWeight) * 100;
  }
}

export class StudyModel {
  readonly processedStudy: ProcessedStudy;
  readonly options: ProcessingOptions;
  readonly seedType: SeedType;

  constructor(
    study: proto.IStudy,
    options: ProcessingOptions,
    seedType: SeedType,
  ) {
    this.processedStudy = new ProcessedStudy(study, options);
    this.options = options;
    this.seedType = seedType;
  }

  filter(): proto.Study.IFilter | undefined {
    return this.processedStudy.study.filter ?? undefined;
  }

  priority(): StudyPriority {
    return this.processedStudy.getPriority();
  }

  name(): string {
    return this.processedStudy.study.name;
  }

  experiments(f: StudyFilter): ExperimentModel[] {
    const study = this.processedStudy.study;
    if (study.experiment == null) return [];
    const models: ExperimentModel[] = [];
    for (const e of study.experiment) {
      if (e.probability_weight > 0 || f === undefined || f.showEmptyGroups) {
        const model = new ExperimentModel(e, this);
        models.push(model);
      }
    }
    return models;
  }

  platforms(): string[] | undefined {
    return this.filter()?.platform?.map((p) => getPlatfromName(p));
  }

  channels(): string[] | undefined {
    const isBraveSeed = this.seedType !== SeedType.UPSTREAM;
    return this.filter()?.channel?.map((c) => getChannelName(c, isBraveSeed));
  }
}

export class StudyListModel {
  processedStudies: StudyModel[] = [];
  constructor(
    studies: proto.IStudy[],
    options: ProcessingOptions,
    type: SeedType,
  ) {
    this.processedStudies = studies.map(
      (study) => new StudyModel(study, options, type),
    );
  }

  studies(f: StudyFilter): StudyModel[] {
    return this.processedStudies.filter((s) =>
      s.processedStudy.matchesFilter(f),
    );
  }
}
