// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
module.exports = {
  blocklistedFeatures: [
    'AutofillUseApi',
    'Ukm',
    'UkmSamplingRate',
    'HappinessTrackingSurveysForDesktopWhatsNew',
    'VariationsGoogleGroupFiltering',
    'ExpiredHistogramLogic',
    'UMANonUniformityLogNormal',
    'PostFREFixMetricsReporting',
    'UMAPseudoMetricsEffect',
  ],

  blocklistedStudies: [
    'UKM',
    'MetricsAndCrashSampling',
    'MetricsClearLogsOnClonedInstall',
  ],

  gpuRelatedFeatures: [
    'DefaultANGLEVulkan',
    'DefaultPassthroughCommandDecoder',
    'EnableDrDcVulkan',
    'Vulkan',
    'VulkanFromANGLE',
    'VulkanV2',
    'VulkanVMALargeHeapBlockSizeExperiment',
  ],

  channelId: 'C05S50MFHPE', // #finch-updates

  // Add your slack ID to get alerts about changing features.
  // Please note that alerts are only sent for changes in stable channel,
  // not in beta or dev.
  // To retrive it use Slack profile => Copy Member ID.
  alerts: [
    {
      description: 'Kill switches changes detected',
      killSwitch: true, // matches to any kill switch change
      ids: [
        'U02DG0ATML3', // matuchin
        'D02NL528E2Y', // clifton
        'UB9PF4X5K', // Terry
      ],
    },
    {
      description: ':x: Processing errors detected',
      processingError: true, // matches to any processing error
      ids: [
        'U02DG0ATML3', // atuchin
        'D02NL528E2Y', // clifton
      ],
    },
    {
      description: 'GPU related changes detected',
      features: [
        'DefaultANGLEVulkan',
        'DefaultPassthroughCommandDecoder',
        'EnableDrDcVulkan',
        'Vulkan',
        'VulkanFromANGLE',
        'VulkanV2',
        'VulkanVMALargeHeapBlockSizeExperiment',
      ],
      ids: [
        'U0D73ULKD', // serg
      ],
    },
    {
      description: 'WebUSBBlocklist changes detected',
      features: ['WebUSBBlocklist'],
      ids: [
        'U02031KK8SY', // shivan
      ],
    },
  ],
};
