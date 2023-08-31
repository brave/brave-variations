// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import Vue from 'vue';
import { variations as proto } from '../../proto/generated/proto_bundle';
import { StudyPriority } from '../../core/study_classifier';
import { type ProcessingOptions } from '../../core/core_utils';
import { StudyModel } from './models';

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
