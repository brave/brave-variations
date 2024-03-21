// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { spawnSync } from 'child_process';
import { program } from 'commander';

// @ts-expect-error lint-staged is not typed.
import lintStaged from 'lint-staged';

program
  .option('-b, --base <value>', 'base branch')
  .option('-f, --fix', 'automatically fix problems')
  .action(main)
  .parse();

interface Options {
  base?: string;
  fix: boolean;
}

async function main(options: Options) {
  if (options.base === undefined) {
    options.base = getBaseBranch(['origin/main', 'origin/production']);
    console.log(`Base branch: ${options.base}`);
  }
  const passed: boolean = await lintStaged({
    allowEmpty: false,
    concurrent: !options.fix,
    config: createLintStagedConfig(options),
    cwd: process.cwd(),
    diff: options.base !== undefined ? `${options.base}..HEAD` : undefined,
  });
  process.exitCode = passed ? 0 : 1;
}

function isCurrentBranchAncestorOf(base: string): boolean {
  const { status } = spawnSync('git', [
    'merge-base',
    '--is-ancestor',
    base,
    'HEAD',
  ]);
  return status === 0;
}

function getBaseBranch(baseBranches: string[]): string {
  for (const base of baseBranches) {
    if (isCurrentBranchAncestorOf(base)) {
      return base;
    }
  }
  console.error(
    `Current branch is not an ancestor of any of the base branches: ${baseBranches.join(
      ', ',
    )}`,
  );
  process.exit(1);
}

function createLintStagedConfig(options: Options): any {
  const config: Record<string, any> = {
    '*': 'prettier  --ignore-unknown' + (options.fix ? ' --write' : ' --check'),
    '*.{ts,js,tsx,jsx}':
      'eslint --config src/.eslintrc.js' + (options.fix ? ' --fix' : ''),
  };

  if (!options.fix) {
    config['*.ts?(x)'] = () => 'tsc --noEmit --project src';
  }

  return config;
}
