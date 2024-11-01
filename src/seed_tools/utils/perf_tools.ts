// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Study_Experiment } from '../../proto/generated/study';
import { VariationsSeed } from '../../proto/generated/variations_seed';

// A function to process each study by replacing the original list of
// experiments with a list containing only the most probable experiment.
export function retainMostProbableExperiments(seed: VariationsSeed) {
  for (const study of seed.study) {
    if (study.experiment.length < 1) continue;
    let best: Study_Experiment | undefined;
    for (const exp of study.experiment) {
      if ((exp.probability_weight ?? 0) > (best?.probability_weight ?? 0)) {
        best = exp;
      }
    }
    if (!best) {
      continue;
    }

    best.probability_weight = 100;
    study.experiment = [best];

    // default_experiment_name should be set to works with
    // --enable-gpu-benchmarking chromium switch which enforces using
    // the default experiment for all studies.
    study.default_experiment_name = best.name;
  }
}
