// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as url_utils from '../../core/url_utils';
import { Study_Experiment } from '../../proto/generated/study';
import { type StudyModel } from './study_model';

export class FeatureModel {
  name: string;
  link: string;
}

export class ExperimentModel {
  private readonly experiment: Study_Experiment;
  private readonly studyModel: StudyModel;

  constructor(experiment: Study_Experiment, studyModel: StudyModel) {
    this.experiment = experiment;
    this.studyModel = studyModel;
  }

  private getFeatures(features?: string[] | null): FeatureModel[] {
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
    return ((this.experiment.probability_weight ?? 0) / totalWeight) * 100;
  }

  isMajorGroup(): boolean {
    return this.weight() > 50;
  }
}
