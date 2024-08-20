// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { program } from '@commander-js/extra-typings';
import * as fs from 'fs';

const dirsToRemove = ['./src/finch_tracker/build', './src/web/public/bundle'];

program.description('Cleans build directories').action(main).parse();

function main() {
  fs.readdirSync('src/proto/generated').forEach((file) => {
    if (file.startsWith('proto_bundle')) {
      fs.unlinkSync(`src/proto/generated/${file}`);
    }
  });

  for (const dir of dirsToRemove) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
}
