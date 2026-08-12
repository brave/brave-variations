// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { asPosix } from '../base/path_utils';
import { parseStudyFile } from '../seed_tools/utils/study_json_utils';

const REPO_BLOB_BASE = 'https://github.com/brave/brave-variations/blob/main/';

program
  .description(
    'Find outdated studies: no max_version set and last modified 3+ months ago.',
  )
  .argument(
    '[studies_dir]',
    'path to the directory containing study files',
    'studies',
  )
  .option(
    '-m, --months <months>',
    'minimum months since last modification',
    (value) => {
      const months = Number.parseInt(value, 10);
      if (!Number.isFinite(months) || months < 0) {
        throw new Error(`Invalid --months value: ${value}`);
      }
      return months;
    },
    3,
  )
  .option(
    '-o, --output <file>',
    'write Slack mrkdwn JSON payload to the given file',
  )
  .option('--channel <channel>', 'Slack channel to send the payload to')
  .action(main)
  .parse();

interface Options {
  months: number;
  output?: string;
  channel?: string;
}

interface OutdatedStudy {
  name: string;
  filePath: string;
  date: Date;
  author: string;
}

async function main(studiesDir: string, options: Options) {
  const outdated = await findOutdatedStudies(studiesDir, options.months);
  outdated.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name),
  );

  if (options.output !== undefined && options.channel !== undefined) {
    if (outdated.length > 0) {
      fs.writeFileSync(
        options.output,
        toSlackPayload(outdated, options.channel),
      );
    }
    return;
  }

  for (const study of outdated) {
    console.log(`${study.name}\t${formatDate(study.date)}\t${study.author}`);
  }
}

async function findOutdatedStudies(
  studiesDir: string,
  months: number,
): Promise<OutdatedStudy[]> {
  const files = (await fs.promises.readdir(studiesDir))
    .filter((file) => file.endsWith('.json5'))
    .sort();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const outdated: OutdatedStudy[] = [];

  for (const file of files) {
    const filePath = path.join(studiesDir, file);
    const content = await fs.promises.readFile(filePath, 'utf8');
    const { studies, errors } = parseStudyFile(filePath, content);
    if (errors.length > 0) {
      console.error(`Skipping ${filePath}:\n${errors.join('\n')}`);
      continue;
    }

    if (studies.every((study) => study.filter?.max_version)) {
      continue;
    }

    const { commit, date } = getLastCommit(filePath);
    if (date >= cutoff) {
      continue;
    }

    outdated.push({
      name: file.replace(/\.json5$/, ''),
      filePath,
      date,
      author: findPrAuthor(commit),
    });
  }

  return outdated;
}

function getLastCommit(filePath: string): {
  commit: string;
  date: Date;
} {
  const output = execFileSync(
    'git',
    ['log', '-1', '--format=%H%n%cI', '--', filePath],
    { encoding: 'utf8' },
  ).trim();
  if (!output) {
    return { commit: '', date: fs.statSync(filePath).mtime };
  }
  const [commit, date] = output.split('\n');
  return { commit, date: new Date(date) };
}

function findPrAuthor(commit?: string): string {
  if (!commit) {
    return 'unknown';
  }
  try {
    const output = execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--search',
        commit,
        '--state',
        'all',
        '--json',
        'author',
        '--limit',
        '1',
      ],
      { encoding: 'utf8' },
    ).trim();
    const prs = JSON.parse(output) as {
      author?: { login?: string; name?: string };
    }[];
    const login = prs[0]?.author?.login ?? '';
    const name = prs[0]?.author?.name ?? '';
    if (login && name) {
      return `${login} (${name})`;
    }
    return login || name || 'unknown';
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Failed to look up PR for ${commit}: ${message}`);
    return 'unknown';
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function toSlackPayload(studies: OutdatedStudy[], channel: string): string {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Outdated studies' },
    },
    ...studies.map((study) => {
      const fileUrl = REPO_BLOB_BASE + asPosix(study.filePath);
      const name = `<${fileUrl}|${study.name}>`;
      const date = formatDate(study.date);
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${name}, ${date}, ${study.author}`,
        },
      };
    }),
  ];

  return (
    JSON.stringify(
      { channel, text: 'Outdated studies detected', blocks },
      null,
      2,
    ) + '\n'
  );
}
