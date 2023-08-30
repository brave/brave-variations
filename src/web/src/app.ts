import Vue from 'vue'
import {variations as proto} from '../../core/generated/proto_bundle';
// CSS
require('../css/bootstrap.min.css');
require('../css/style.css');

// JS
Vue.component('study-item', {
  props: ['study'],
  template:
    `<div class="card mb-3">
      <div class="card-header">{{ study.name }}</div>
      <div class="card-body">
        <ul class="list-group list-group-flush">
          <li class="list-group-item" v-for="experiment in study.experiment">
            {{ experiment.name }} ({{ experiment.probabilityWeight }}%)
            <ul class="study-meta">
              <span>Enabled Features:</span>
              <li v-for="feature in experiment.processedEnabledFeatures">{{ feature }}</li>
            </ul>
            <ul class="study-meta">
              <span>Disabled Features:</span>
              <li v-for="feature in experiment.processedDisabledFeatures">{{ feature }}</li>
            </ul>
            <ul class="study-meta">
              <span>Parameters:</span>
              <li v-for="parameter in experiment.processedParameters">{{ parameter }}</li>
            </ul>
          </li>
        </ul>
      </div>
      <div class="card-footer">
        <ul class="study-meta">
          <span>Channels:</span>
          <li v-for="channel in study.filter.processedChannels">{{ channel }}</li>
        </ul>
        <ul class="study-meta">
          <span>Countries:</span>
          <li v-for="country in study.filter.processedCountries">{{ country }}</li>
        </ul>
        <ul class="study-meta">
          <span>Platforms:</span>
          <li v-for="platform in study.filter.processedPlatforms">{{ platform }}</li>
        </ul>
      </div>
    </div>`
})

// const SeedType = Object.freeze({
//   PRODUCTION:   Symbol("Production"),
//   STAGING:  Symbol("Staging"),
//   UPSTREAM: Symbol("Upstream")
// });
enum SeedType{
  PRODUCTION,
  STAGING,
  UPSTREAM,
}

Vue.prototype.SeedType = SeedType

const app = new Vue({
  el: '#app',
  data: {
    loading: true,
    currentSeedType: SeedType.PRODUCTION,
    studies: new Map(Object.values(SeedType).map((key) => [key, []])),
    isSeedLoaded: {}
  },
  async created() {
    const variationsStagingUrl = "http://127.0.0.1:8000/staging_seed"
    const variationsProductionUrl = "http://127.0.0.1:8000/production_seed"
    const chromeUrl = "http://127.0.0.1:8000/chrome_seed"

    await loadSeed(variationsProductionUrl, SeedType.PRODUCTION)
    await loadSeed(variationsStagingUrl, SeedType.STAGING)

    await loadSeed(chromeUrl, SeedType.UPSTREAM)

    this.loading = false
  },
  methods: {
    addStudy: function(currentSeedType: SeedType, study: proto.IStudy) {
      this.studies.get(currentSeedType).push(study)
    },
  }
})

async function loadSeed(url: string, type : SeedType): Promise<void> {
  await new Promise<void>((resolve, reject) =>{
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true /* async */);
    xhr.responseType = "arraybuffer";
    xhr.onload = (evt) => { onLoadSeed(xhr.response, type); resolve()};
    xhr.onerror = (e) => { reject(e); };
    xhr.send(null);
  });
}

function onLoadSeed(seedProtobufBytes: any, type: SeedType): void {
  const seedBytes = new Uint8Array(seedProtobufBytes);
  const seed = proto.VariationsSeed.decode(seedBytes);

  seed.study.forEach(study => {
    app.addStudy(type, processStudy(study))
  });
}

function getChannel(ix) {
  const channels = { Unknown: -1, Nightly: 0, Dev: 1, Beta: 2, Release: 3 }
  return Object.keys(channels).find(key => channels[key] === ix)
}

function getPlatform(ix) {
  const platforms = { Windows: 0, Mac: 1, Linux: 2, Android: 4, iOS: 5 }
  return Object.keys(platforms).find(key => platforms[key] === ix)
}

function processStudy(study) {
  // Channels
  const processedChannel: string[] = [];
  study.filter.channel.forEach(channel_ix => {
    const channel = getChannel(channel_ix)
    if (channel !== undefined)
    processedChannel.push(channel)
  })

  if (processedChannel.length === 0) {
    processedChannel.push("All")
  }

  study.filter.processedChannels = processedChannel

  // Countries
  const processedCountry: string[] = [];
  study.filter.country.forEach(country_ix => {
    processedCountry.push(country_ix.toUpperCase())
  })

  if (processedCountry.length === 0) {
    processedCountry.push("All")
  }

  study.filter.processedCountries = processedCountry

  // Platforms
  const processedPlatforms: string[] = []
  study.filter.platform.forEach(platform_ix => {
    const platform = getPlatform(platform_ix);
    if (platform !== undefined)
      processedPlatforms.push(platform)
  })

  if (processedPlatforms.length === 0) {
    processedPlatforms.push("All")
  }

  study.filter.processedPlatforms = processedPlatforms

  // Experiments
  for (let i = 0; i < study.experiment.length; i++) {
    // Features
    const experiment = study.experiment[i]

    const processedEnabledFeatures: string[] = []
    const processedDisabledFeatures: string[] = []

    if (experiment.featureAssociation) {
      experiment.featureAssociation.enableFeature.forEach(feature => {
        processedEnabledFeatures.push(feature)
      })

      experiment.featureAssociation.disableFeature.forEach(feature => {
        processedDisabledFeatures.push(feature)
      })
    }

    if (processedEnabledFeatures.length === 0) {
      processedEnabledFeatures.push("None")
    }

    study.experiment[i].processedEnabledFeatures = processedEnabledFeatures

    if (processedDisabledFeatures.length === 0) {
      processedDisabledFeatures.push("None")
    }

    study.experiment[i].processedDisabledFeatures = processedDisabledFeatures

    // Parameters
    const processedParameters: string[] = []
    if (experiment.param) {
      experiment.param.forEach(parameter => {
        processedParameters.push(parameter.name + ": " + parameter.value)
      })
    }

    if (processedParameters.length === 0) {
      processedParameters.push("None")
    }

    study.experiment[i].processedParameters = processedParameters
  }

  return study
}
