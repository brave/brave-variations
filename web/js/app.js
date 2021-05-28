// CSS
require('../css/bootstrap.min.css');
require('../css/style.css');

// JS
var protobuf = require('protobufjs');
var Vue = require('vue')

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

var app = new Vue({
  el: '#app',
  data: {
    loading: true,
    stagingStudies: [],
    productionStudies: [],
    isProduction: true
  },
  async created() {
    let variationsStagingUrl = "https://variations.bravesoftware.com/seed"
    let variationsProductionUrl = "https://variations.brave.com/seed"

    await loadSeed(variationsProductionUrl, /* isProduction */ true)
    await loadSeed(variationsStagingUrl, /* isProduction */ false)

    this.loading = false
  },
  methods: {
    addStagingStudy: function(study) {
      this.stagingStudies.push(study)
    },
    addProductionStudy: function(study) {
      this.productionStudies.push(study)
    }
  }
})

async function loadSeed(url, isProduction) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", url, true /* async */);
  xhr.responseType = "arraybuffer";
  xhr.onload = (evt) => onLoadSeed(xhr.response, isProduction);
  xhr.send(null);
}

function onLoadSeed(seedProtobufBytes, isProduction) {
  let seedBytes = new Uint8Array(seedProtobufBytes);
  protobuf.load("../proto/variations_seed.proto", function (err, root) {
    if (err) { throw err; }
    let variationSeedType = root.lookupType("variations.VariationsSeed");
    let seed = variationSeedType.decode(seedBytes);

    seed['study'].forEach(study => {
      if (isProduction) {
        app.addProductionStudy(processStudy(study))
      } else {
        app.addStagingStudy(processStudy(study))
      }
    });
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
  const _study = Object.assign({}, study);

  // Channels
  _study.filter.processedChannels = getProcessedChannels(_study);

  // Countries
  _study.filter.processedCountries = getProcessedCountries(_study);

  // Platforms
  _study.filter.processedPlatforms = getProcessedPlatforms(_study);

  // Experiments
  for (let i = 0; i < _study.experiment.length; i++) {
    // Features
    let experiment = _study.experiment[i];

    let processedEnabledFeatures = ["None"];
    let processedDisabledFeatures = ["None"];

    if (experiment.featureAssociation.enableFeature?.length) {
      processedEnabledFeatures = [
        ...experiment.featureAssociation.enableFeature
      ];

      processedDisabledFeatures = [
        ...experiment.featureAssociation.disableFeature
      ];
    }

    _study.experiment[i].processedEnabledFeatures = processedEnabledFeatures;
    _study.experiment[i].processedDisabledFeatures = processedDisabledFeatures;

    // Parameters
    _study.experiment[i].processedParameters = getProcessedParameters(experiment);
  }

  return _study;
}

function getProcessedParameters(experiment) {
  const processedParameters = [];

  if (experiment.param) {
    experiment.param.forEach((parameter) => {
      processedParameters.push(parameter.name + ": " + parameter.value);
    });
  }

  if (!processedParameters.length) {
    processedParameters.push("None");
  }

  return processedParameters;
}

function getProcessedCountries(study) {
  const processedCountry = [];
  study.filter.country.forEach((country_ix) => {
    processedCountry.push(country_ix.toUpperCase());
  });

  if (!processedCountry.length) {
    processedCountry.push("All");
  }

  return processedCountry;
}

function getProcessedChannels(study) {
  const processedChannel = [];
  study.filter.channel.forEach((channel_ix) => {
    processedChannel.push(getChannel(channel_ix));
  });

  if (!processedChannel.length) {
    processedChannel.push("All");
  }

  return processedChannel;
}

function getProcessedPlatforms(study) {
  const processedPlatforms = [];

  study.filter.platform.forEach((platform_ix) => {
    processedPlatforms.push(getPlatform(platform_ix));
  });

  if (!processedPlatforms.length) {
    processedPlatforms.push("All");
  }

  return processedPlatforms;
}
