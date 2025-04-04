// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { SeedType } from '../../core/base_types';
import {
  type ProcessedStudy,
  type StudyFilter,
  type StudyPriority,
} from '../../core/study_processor';
import * as url_utils from '../../core/url_utils';
import {
  Study_Channel,
  Study_Filter,
  Study_Platform,
} from '../../proto/generated/study';
import {
  channelToString,
  platformToString,
} from '../../seed_tools/utils/converters';
import { ExperimentModel } from './experiment_model';

export class StudyModel {
  readonly processedStudy: ProcessedStudy;
  readonly seedType: SeedType;
  readonly id: number; // unique id used as keys in React lists.

  constructor(processedStudy: ProcessedStudy, seedType: SeedType, id: number) {
    this.processedStudy = processedStudy;
    this.seedType = seedType;
    this.id = id;
  }

  filter(): Study_Filter | undefined {
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
      if (
        (e.probability_weight ?? 0) > 0 ||
        f === undefined ||
        f.showEmptyGroups
      ) {
        const model = new ExperimentModel(e, this);
        models.push(model);
      }
    }
    return models;
  }

  platforms(): string[] | undefined {
    return this.filter()?.platform?.map((p) =>
      platformToString(Study_Platform[p]),
    );
  }

  channels(): string[] | undefined {
    return this.filter()?.channel?.map((c) =>
      channelToString(Study_Channel[c], this.seedType === SeedType.UPSTREAM),
    );
  }

  getConfigUrl(): string {
    return url_utils.getStudyRawConfigUrl(this.name(), this.seedType);
  }
}

export class StudyListModel {
  readonly processedStudies: StudyModel[];
  constructor(studies: StudyModel[]) {
    this.processedStudies = studies;
  }

  filterStudies(f: StudyFilter): StudyModel[] {
    return this.processedStudies.filter((s) => f.matches(s.processedStudy));
  }
}
