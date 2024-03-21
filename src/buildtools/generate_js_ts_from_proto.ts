// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { nodeModulesPath, wsPath } from './path_utils';

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
  execFileSync(
    'node',
    [
      nodeModulesPath('protobufjs-cli/bin/pbjs'),
      '--t',
      'static-module',
      '--keep-case',
      `${protoDir}/study.proto`,
      `${protoDir}/variations_seed.proto`,
      '-o',
      `${protoGeneratedDir}/proto_bundle.js`,
    ],
    { stdio: 'inherit' },
  );

  execFileSync(
    'node',
    [
      nodeModulesPath('protobufjs-cli/bin/pbts'),
      '-o',
      `${protoGeneratedDir}/proto_bundle.d.ts`,
      `${protoGeneratedDir}/proto_bundle.js`,
    ],
    { stdio: 'inherit' },
  );
}

function generateProtobufTs() {
  execFileSync(
    'node',
    [
      nodeModulesPath('@protobuf-ts/protoc/protoc'),
      '--ts_out',
      protoGeneratedDir,
      '--proto_path',
      protoDir,
      `${protoDir}/*.proto`,
    ],
    { stdio: 'inherit' },
  );
}

removeGeneratedFiles();
generateProtobufJsWithTypeInfo();
generateProtobufTs();
