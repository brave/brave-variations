// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import Vue from 'vue';
import { variations as proto } from '../../proto/generated/proto_bundle';
import { ProcessedStudy, StudyPriority } from '../../core/study_classifier';
import {
  getChannelName,
  getPlatfromName,
  getChromiumFeatureUrl,
  type ProcessingOptions,
} from '../../core/core_utils';

// CSS
require('css/bootstrap.min.css');
require('css/style.css');

// JS
Vue.component('study-item', {
  props: ['study'],
  template: `<div class="card mb-3">
      <div class="card-header">{{ study.name() }}</div>
      <div class="card-body">
        <ul class="list-group list-group-flush">
          <li class="list-group-item" v-for="experiment in study.experiments()">
            {{ experiment.name() }} ({{ experiment.weight() }}%)
            <ul class="study-meta" v-if="experiment.enabledFeatures().length > 0">
              <span>Enabled Features:</span>
              <li v-for="feature in experiment.enabledFeatures()">
                <a v-if="feature.link" class="enabled-feature" v-bind:href="feature.link">{{ feature.name }}</a>
                <font v-if="!feature.link" class="enabled-feature">{{ feature.name }}</font>
              </li>
            </ul>
            <ul class="study-meta" v-if="experiment.disabledFeatures().length > 0">
              <span>Disabled Features:</span>
              <li v-for="feature in experiment.disabledFeatures()">
                <a v-if="feature.link" class="disabled-feature" v-bind:href="feature.link">{{ feature.name }}</a>
                <font v-if="!feature.link" class="disabled-feature">{{ feature.name }}</font>
            </li>
            </ul>
            <ul class="study-meta" v-if="experiment.parameters().length > 0">
              <span>Parameters:</span>
              <li v-for="parameter in experiment.parameters()">{{ parameter }}</li>
            </ul>
          </li>
        </ul>
      </div>
      <div class="card-footer">
        <ul class="study-meta">
          <span>Channels:</span>
          <li v-for="channel in study.channels()">{{ channel }}</li>
        </ul>
        <ul class="study-meta" v-if="study.countries().length > 0">
          <span>Countries:</span>
          <li v-for="country in study.countries()">{{ country }}</li>
        </ul>
        <ul class="study-meta">
          <span>Platforms:</span>
          <li v-for="platform in study.platforms()">{{ platform }}</li>
        </ul>
      </div>
    </div>`,
});

enum SeedType {
  PRODUCTION,
  STAGING,
  UPSTREAM,
}

Vue.prototype.SeedType = SeedType; // TODO
interface FeatureModel {
  name: string;
  link: string;
}

class ExperimentModel {
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

class StudyModel {
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

const app = new Vue({
  el: '#app',
  data: {
    loading: true,
    currentSeedType: SeedType.PRODUCTION,
    studies: new Map<SeedType, StudyModel>(),
    hasUpstream: false,
  },
  async created() {
    const variationsStagingUrl = 'http://127.0.0.1:8000/staging_seed';
    const variationsProductionUrl = 'http://127.0.0.1:8000/production_seed';
    const chromeUrl = 'http://127.0.0.1:8000/chrome_seed';

    await loadSeed(variationsProductionUrl, SeedType.PRODUCTION);
    await loadSeed(variationsStagingUrl, SeedType.STAGING);

    if (await loadSeed(chromeUrl, SeedType.UPSTREAM)) this.hasUpstream = true;

    this.loading = false;
  },
  methods: {
    addStudy: function (type: SeedType, study: StudyModel) {
      if (this.studies.has(type) === false) this.studies.set(type, []);
      if (type === SeedType.UPSTREAM) {
        const minPriority = StudyPriority.STABLE_MIN;
        if (study.priority() <= minPriority) return;
      }
      this.studies.get(type).push(study);
    },
  },
});

async function loadSeed(url: string, type: SeedType): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true /* async */);
    xhr.responseType = 'arraybuffer';
    xhr.onload = (evt) => {
      onLoadSeed(xhr.response, type);
      resolve(true);
    };
    xhr.onerror = (e) => {
      resolve(false);
    };
    xhr.send(null);
  });
}

function onLoadSeed(seedProtobufBytes: any, type: SeedType): void {
  const seedBytes = new Uint8Array(seedProtobufBytes);
  const seed = proto.VariationsSeed.decode(seedBytes);

  const isUpstream = type === SeedType.UPSTREAM;
  // TODO: get minMajorVersion
  const options: ProcessingOptions = {
    isBraveSeed: !isUpstream,
    minMajorVersion: 116,
  };
  seed.study.forEach((study) => {
    app.addStudy(type, new StudyModel(study, options));
  });
}
