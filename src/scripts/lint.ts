// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';
import { execSync } from 'child_process';

program
  .description(
    "The 'lint' command checks for code style issues in the modified files of the\n" +
      'current branch. It identifies the changed files, filters them by supported\n' +
      'types, and runs the corresponding linters. Use this command to ensure code\n' +
      'quality before committing or pushing changes.',
  )
  .option('-f, --fix', 'automatically fix problems')
  .action(main)
  .parse();

interface Options {
  fix?: true;
}

function main(options: Options) {
  process.exitCode = lintAllFiles(options);
}

// Returns an array of commands to lint all files.
function getLintAllCommands(options: Options): string[] {
  return [
    'prettier . --ignore-unknown' + (options.fix ? ' --write' : ' --check'),
    'eslint . --config src/.eslintrc.js' + (options.fix ? ' --fix' : ''),
    'npm run seed_tools lint --' + (options.fix ? ' --fix' : ''),
  ];
}

function lintAllFiles(options: Options): number {
  for (const command of getLintAllCommands(options)) {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  }

  return 0;
}
