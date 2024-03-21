// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as execa from 'execa';
import * as fs from 'fs';
import { wsPath } from './path_utils';

const protoDir = wsPath('//proto');
const protoGeneratedDir = wsPath('//proto/generated');

function removeGeneratedFiles() {
  const files = fs.readdirSync(protoGeneratedDir);
  files.forEach((file) => {
    if (file.match(/.*\.(ts|js)$/) !== null) {
      fs.unlinkSync(`${protoGeneratedDir}/${file}`);
    }
  });
}

function generateProtobufJsWithTypeInfo() {
  execa.execaSync(
    'pbjs',
    [
      '--t',
      'static-module',
      '--keep-case',
      `${protoDir}/study.proto`,
      `${protoDir}/variations_seed.proto`,
      '-o',
      `${protoGeneratedDir}/proto_bundle.js`,
    ],
    { stdio: 'inherit', preferLocal: true },
  );

  execa.execaSync(
    'pbts',
    [
      '-o',
      `${protoGeneratedDir}/proto_bundle.d.ts`,
      `${protoGeneratedDir}/proto_bundle.js`,
    ],
    { stdio: 'inherit', preferLocal: true },
  );
}

function generateProtobufTs() {
  try {
    // Apply study.proto patch to make protobuf-ts serialize probability_weight
    // field if its value is 0.
    gitApplyStudyProtoPatch();
    execa.execaSync(
      'protoc',
      [
        '--ts_out',
        protoGeneratedDir,
        '--proto_path',
        protoDir,
        `${protoDir}/*.proto`,
      ],
      { stdio: 'inherit', preferLocal: true },
    );
  } finally {
    gitRevertStudyProtoPatch();
  }
}

function gitApplyStudyProtoPatch() {
  execa.execaSync(
    'git',
    ['apply', `${protoDir}/study.proto.protobuf-ts.patch`],
    {
      cwd: protoDir,
      stdio: 'inherit',
    },
  );
}

function gitRevertStudyProtoPatch() {
  execa.execaSync(
    'git',
    ['apply', '-R', `${protoDir}/study.proto.protobuf-ts.patch`],
    { cwd: protoDir, stdio: 'inherit' },
  );
}

removeGeneratedFiles();
generateProtobufJsWithTypeInfo();
generateProtobufTs();
