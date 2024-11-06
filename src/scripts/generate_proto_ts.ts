// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { wsPath } from '../base/path_utils';

const protoDir = wsPath('//src/proto');

const protoFiles = [
  `${protoDir}/client_variations.proto`,
  `${protoDir}/layer.proto`,
  `${protoDir}/study.proto`,
  `${protoDir}/variations_seed.proto`,
];

const protoGeneratedDir = wsPath('//src/proto/generated');

program
  .description('Generates Protobuf TS files')
  .option('--generate_patch', 'Generate patch for study.proto')
  .action(main)
  .parse();

interface Options {
  generate_patch?: true;
}

function main(options: Options) {
  if (options.generate_patch) {
    generateStudyProtoPatch();
    return;
  }

  removeGeneratedFiles();
  generateProtobufTs();
}

function removeGeneratedFiles() {
  const files = fs.readdirSync(protoGeneratedDir);
  files.forEach((file) => {
    if (/.*\.(ts|js)$/.test(file)) {
      fs.unlinkSync(`${protoGeneratedDir}/${file}`);
    }
  });
}

function generateProtobufTs() {
  try {
    // Apply study.proto patch to make protobuf-ts serialize probability_weight
    // field if its value set to 0.
    gitApplyStudyProtoPatch();
    execSync(
      [
        'npx',
        '--',
        'protoc',
        '--ts_out',
        protoGeneratedDir,
        '--proto_path',
        protoDir,
        ...protoFiles,
        '--ts_opt',
        'use_proto_field_name',
      ].join(' '),
    );
  } finally {
    gitRevertStudyProtoPatch();
  }
}

function generateStudyProtoPatch() {
  fs.writeFileSync(
    `${protoDir}/study.proto.protobuf-ts.patch`,
    execSync(`git diff ${protoDir}/study.proto`, {
      encoding: 'buffer',
    }),
  );
}

function gitApplyStudyProtoPatch() {
  execSync(`git apply ${protoDir}/study.proto.protobuf-ts.patch`, {
    cwd: protoDir,
    stdio: 'inherit',
  });
}

function gitRevertStudyProtoPatch() {
  execSync(`git apply -R ${protoDir}/study.proto.protobuf-ts.patch`, {
    cwd: protoDir,
    stdio: 'inherit',
  });
}
