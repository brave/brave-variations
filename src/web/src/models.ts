// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type variations as proto } from '../../proto/generated/proto_bundle';
import {
  ProcessedStudy,
  type StudyFilter,
  type StudyPriority,
} from '../../core/study_classifier';
import {
  getChannelName,
  getPlatfromName,
  getChromiumFeatureUrl,
  type ProcessingOptions,
} from '../../core/core_utils';

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
      this.studyModel.processedStudy.filterDetails.totalWeight;
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
    return this.filter()?.channel?.map((c) =>
      getChannelName(c, this.options.isBraveSeed),
    );
  }
}

export class StudyListModel {
  processedStudies: StudyModel[];
  constructor(studies: proto.IStudy[], options: ProcessingOptions) {
    this.processedStudies = studies.map(
      (study) => new StudyModel(study, options),
    );
  }

  studies(f: StudyFilter): StudyModel[] {
    return this.processedStudies.filter((s) =>
      s.processedStudy.matchesFilter(f),
    );
  }
}
