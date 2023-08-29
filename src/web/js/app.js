// CSS
require('../css/bootstrap.min.css');
require('../css/style.css');

// JS
var Vue = require('vue')
const proto_bundle = require('../static/generated/proto_bundle');

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

const SeedType = Object.freeze({
  PRODUCTION:   Symbol("Production"),
  STAGING:  Symbol("Staging"),
  UPSTREAM: Symbol("Upstream")
});
Vue.prototype.SeedType = SeedType

var app = new Vue({
  el: '#app',
  data: {
    loading: true,
    currentSeedType: SeedType.PRODUCTION,
    studies: new Map(Object.values(SeedType).map((key) => [key, []])),
    isSeedLoaded: {}
  },
  async created() {
    let variationsStagingUrl = "http://127.0.0.1:8000/staging_seed"
    let variationsProductionUrl = "http://127.0.0.1:8000/production_seed"
    let chromeUrl = "http://127.0.0.1:8000/chrome_seed"

    await loadSeed(variationsProductionUrl, SeedType.PRODUCTION)
    await loadSeed(variationsStagingUrl, SeedType.STAGING)

    await loadSeed(chromeUrl, SeedType.UPSTREAM)

    this.loading = false
  },
  methods: {
    addStudy: function(currentSeedType, study) {
      this.studies.get(currentSeedType).push(study)
    },
  }
})

async function loadSeed(url, type) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", url, true /* async */);
  xhr.responseType = "arraybuffer";
  xhr.onload = (evt) => onLoadSeed(xhr.response, type);
  xhr.send(null);
}

function onLoadSeed(seedProtobufBytes, type) {
  let seedBytes = new Uint8Array(seedProtobufBytes);
  let variationSeedType = proto_bundle.variations.VariationsSeed;
  let seed = variationSeedType.decode(seedBytes);

  seed['study'].forEach(study => {
    app.addStudy(type, processStudy(study))
  });
}

function getChannel(ix) {
  let channels = { Unknown: -1, Nightly: 0, Dev: 1, Beta: 2, Release: 3 }
  return Object.keys(channels).find(key => channels[key] === ix)
}

function getPlatform(ix) {
  let platforms = { Windows: 0, Mac: 1, Linux: 2, Android: 4, iOS: 5 }
  return Object.keys(platforms).find(key => platforms[key] === ix)
}

function processStudy(study) {
  // Channels
  processedChannel = [];
  study.filter.channel.forEach(channel_ix => {
    processedChannel.push(getChannel(channel_ix))
  })

  if (!processedChannel.length) {
    processedChannel.push("All")
  }

  study.filter.processedChannels = processedChannel

  // Countries
  processedCountry = [];
  study.filter.country.forEach(country_ix => {
    processedCountry.push(country_ix.toUpperCase())
  })

  if (!processedCountry.length) {
    processedCountry.push("All")
  }

  study.filter.processedCountries = processedCountry

  // Platforms
  processedPlatforms = []
  study.filter.platform.forEach(platform_ix => {
    processedPlatforms.push(getPlatform(platform_ix))
  })

  if (!processedPlatforms.length) {
    processedPlatforms.push("All")
  }

  study.filter.processedPlatforms = processedPlatforms

  // Experiments
  for (let i = 0; i < study.experiment.length; i++) {
    // Features
    let experiment = study.experiment[i]

    processedEnabledFeatures = []
    processedDisabledFeatures = []

    if (experiment.featureAssociation) {
      experiment.featureAssociation.enableFeature.forEach(feature => {
        processedEnabledFeatures.push(feature)
      })

      experiment.featureAssociation.disableFeature.forEach(feature => {
        processedDisabledFeatures.push(feature)
      })
    }

    if (!processedEnabledFeatures.length) {
      processedEnabledFeatures.push("None")
    }

    study.experiment[i].processedEnabledFeatures = processedEnabledFeatures

    if (!processedDisabledFeatures.length) {
      processedDisabledFeatures.push("None")
    }

    study.experiment[i].processedDisabledFeatures = processedDisabledFeatures

    // Parameters
    processedParameters = []
    if (experiment.param) {
      experiment.param.forEach(parameter => {
        processedParameters.push(parameter.name + ": " + parameter.value)
      })
    }

    if (!processedParameters.length) {
      processedParameters.push("None")
    }

    study.experiment[i].processedParameters = processedParameters
  }

  return study
}
