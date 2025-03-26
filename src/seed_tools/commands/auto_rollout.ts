// Copyright (c) 2025 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { execAsync } from '../../base/child_process_async';
import DefaultMap from '../../base/containers/default_map';
import { Study, Study_Channel } from '../../proto/generated/study';
import { readStudiesFromDirectory } from '../utils/studies_to_seed';

export default function createCommand() {
  return new Command('auto_rollout')
    .description('Auto rollout studies')
    .argument(
      '[studies_dir]',
      'path to the directory containing study files',
      'studies',
    )
    .action(main);
}

interface Options {}

async function main(studiesDir: string, options: Options) {
  const { studies, studyFileBaseNameMap, errors } =
    await readStudiesFromDirectory(studiesDir, false);
  const filesWithGitModifiedDate =
    await getFilesWithGitModifiedDate(studiesDir);
  for (const { path, lastModified } of filesWithGitModifiedDate) {
    console.log(path, lastModified);
  }
  return;
  const studiesPerFile = new DefaultMap<string, Study[]>(() => []);
  for (const study of studies) {
    const file = studyFileBaseNameMap.get(study);
    if (!file) {
      throw new Error(`Study ${study.name} not found in studyFileBaseNameMap`);
    }
    studiesPerFile.get(file).push(study);
  }
  for (const [file, studies] of studiesPerFile.entries()) {
    const channelCoverage = analyzeStudyRollout(studies);
    console.log(file);
    console.log(channelCoverage);
  }
}

async function getFilesWithGitModifiedDate(
  directory: string,
): Promise<{ path: string; lastModified: Date }[]> {
  console.log('Getting list of files from git...');
  // Get list of files in directory using git ls-files
  const { stdout: fileList } = await execAsync(
    `git ls-tree -r --name-only HEAD "${directory}"`,
  );
  const files = fileList.trim().split('\n').filter(Boolean);
  const results: { path: string; lastModified: Date }[] = [];

  // Process files in parallel batches based on CPU cores
  const cpuCount = require('os').cpus().length;
  const batchSize = Math.ceil(files.length / cpuCount);
  const batches = Array.from({ length: cpuCount }, (_, i) =>
    files.slice(i * batchSize, (i + 1) * batchSize),
  ).filter((batch) => batch.length > 0);

  await Promise.all(
    batches.map(async (batch) => {
      const batchResults = await Promise.all(
        batch.map(async (fullPath) => {
          try {
            // Get last modified date from git log
            const { stdout } = await execAsync(
              `git log -1 --format="%aI" -- "${fullPath}"`,
            );

            if (stdout.trim()) {
              return {
                path: fullPath,
                lastModified: new Date(stdout.trim()),
              };
            }
          } catch (error) {
            console.warn(`\nCould not get git history for ${fullPath}:`, error);
          }
          return null;
        }),
      );

      results.push(
        ...batchResults.filter((r): r is NonNullable<typeof r> => r !== null),
      );
    }),
  );

  // Sort results by path for consistent ordering
  results.sort((a, b) => a.path.localeCompare(b.path));

  return results;
}

interface ChannelCoverage {
  channel: Study_Channel;
  totalWeight: number;
  experimentCount: number;
}

function analyzeStudyRollout(studies: Study[]): ChannelCoverage[] {
  // First, collect all unique channels across all study entries
  const allChannels = new Set<Study_Channel>();
  studies.forEach((study) => {
    study.filter?.channel.forEach((channel: Study_Channel) =>
      allChannels.add(channel),
    );
  });

  // Initialize coverage tracking for each channel
  const channelCoverage = Array.from(allChannels).map((channel) => ({
    channel,
    totalWeight: 0,
    experimentCount: 0,
  }));

  // Analyze each study entry
  studies.forEach((study) => {
    const channels = study.filter?.channel ?? [];
    // Find the "Enabled" experiment (skip "Default" with 0 weight)
    const enabledExperiment = study.experiment.find(
      (exp: any) => exp.name === 'Enabled' && exp.probability_weight > 0,
    );

    if (enabledExperiment) {
      channels.forEach((channel: Study_Channel) => {
        const coverage = channelCoverage.find((c) => c.channel === channel);
        if (coverage) {
          coverage.totalWeight += enabledExperiment.probability_weight ?? 0;
          coverage.experimentCount++;
        }
      });
    }
  });

  return channelCoverage;
}
