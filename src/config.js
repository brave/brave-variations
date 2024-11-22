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

  // Add your slack ID to get notifications about new kill switches.
  // To retrive it use Slack profile => Copy Member ID.
  killSwitchNotificationIds: [
    'U02DG0ATML3', // @matuchin
    'UE87NRK2A', // @iefremov
    'UB9PF4X5K', // @Terry
  ],
  processingErrorNotificationIds: [
    'U02DG0ATML3', // @matuchin
    'UE87NRK2A', // @iefremov
  ],
  gpuRelatedNotificationIds: [
    'U0D73ULKD', // @serg
  ],
};
