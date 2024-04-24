// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { spawnSync } from 'child_process';
import { program } from 'commander';

// @ts-expect-error lint-staged is not typed.
import lintStaged from 'lint-staged';

program
  .description(
    "The 'lint' command checks for code style issues in the modified files of the\n" +
      'current branch. It identifies the changed files, filters them by supported\n' +
      'types, and runs the corresponding linters. Use this command to ensure code\n' +
      'quality before committing or pushing changes.',
  )
  .option('-b, --base <value>', 'base branch to compare against')
  .option('-s, --staged', 'use staged files instead of the branch diff')
  .option('-f, --fix', 'automatically fix problems')
  .action(main)
  .parse();

interface Options {
  base?: string;
  staged: boolean;
  fix: boolean;
}

async function main(options: Options) {
  if (options.base !== undefined && options.staged) {
    console.error('The --base and --staged options are mutually exclusive');
    process.exit(1);
  }
  if (options.base === undefined && !options.staged) {
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

function createLintStagedConfig(options: Options): any {
  const config: Record<string, any> = {
    '*': 'prettier  --ignore-unknown' + (options.fix ? ' --write' : ' --check'),
    '*.{ts,js,tsx,jsx}':
      'eslint --config src/.eslintrc.js' + (options.fix ? ' --fix' : ''),
  };

  if (!options.fix) {
    config['*.ts?(x)'] = () => 'npm run typecheck';
  }

  return config;
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
