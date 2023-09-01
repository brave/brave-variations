// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type variations as proto } from '../../proto/generated/proto_bundle';
import {
  ProcessedStudy,
  type StudyPriority,
} from '../../core/study_classifier';
import {
  getChannelName,
  getPlatfromName,
  getChromiumFeatureUrl,
  type ProcessingOptions,
} from '../../core/core_utils';

export class StudyFilter {
  minPriority: StudyPriority;
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
      const isBraveSeed = this.studyModel.options.isBraveSeed;
      return { name: f, link: isBraveSeed ? '' : getChromiumFeatureUrl(f) };
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
    const totalWeight =
      this.studyModel.processedStudy.priorityDetails.totalWeight;
    if (totalWeight === 0) return 0;
    return (this.experiment.probability_weight / totalWeight) * 100;
  }
}

export class StudyModel {
  readonly processedStudy: ProcessedStudy;
  readonly options: ProcessingOptions;

  constructor(study: proto.IStudy, options: ProcessingOptions) {
    this.processedStudy = new ProcessedStudy(study, options);
    this.options = options;
  }

  raw(): proto.IStudy {
    return this.processedStudy.study;
  }

  priority(): StudyPriority {
    return this.processedStudy.getPriority();
  }

  name(): string {
    return this.raw().name;
  }

  matchesFilter(f: StudyFilter): boolean {
    return this.priority() >= f.minPriority;
  }

  mapToStringList<T>(
    list: T[] | undefined | null,
    fn: (t: T) => string,
  ): string[] {
    if (list == null || list.length === 0) return [];
    return list.map(fn);
  }

  experiments(): ExperimentModel[] {
    const study = this.raw();
    if (study.experiment == null) return [];
    return study.experiment.map((e) => new ExperimentModel(e, this));
  }

  platforms(): string[] {
    return this.mapToStringList(this.raw().filter?.platform, (p) =>
      getPlatfromName(p),
    );
  }

  channels(): string[] {
    return this.mapToStringList(
      // TODO
      this.raw().filter?.channel,
      (c) => getChannelName(c, this.options.isBraveSeed),
    );
  }

  countries(): string[] {
    return this.mapToStringList(this.raw().filter?.country, (c) =>
      c.toString(),
    );
  }
}
