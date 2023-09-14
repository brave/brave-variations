// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type variations as proto } from '../../proto/generated/proto_bundle';
import {
  type ProcessedStudy,
  type StudyFilter,
  type StudyPriority,
} from '../../core/study_processor';
import * as url_utils from '../../core/url_utils';
import { SeedType } from '../../core/base_types';
import { getChannelName, getPlatfromName } from '../../core/serializers';

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
        link: url_utils.getFeatureSearchUrl(f),
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

  isMajorGroup(): boolean {
    return this.weight() > 50;
  }
}

export class StudyModel {
  readonly processedStudy: ProcessedStudy;
  readonly seedType: SeedType;
  readonly id: number;

  constructor(processedStudy: ProcessedStudy, seedType: SeedType, id: number) {
    this.processedStudy = processedStudy;
    this.seedType = seedType;
    this.id = id;
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

  filterExperiments(f: StudyFilter): ExperimentModel[] {
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

  getConfigUrl(): string {
    return url_utils.getGitHubStudyConfigUrl(this.name(), this.seedType);
  }
}

export class StudyListModel {
  readonly processedStudies: StudyModel[];
  constructor(studies: StudyModel[]) {
    this.processedStudies = studies;
  }

  filterStudies(f: StudyFilter): StudyModel[] {
    return this.processedStudies.filter((s) =>
      s.processedStudy.matchesFilter(f),
    );
  }
}
