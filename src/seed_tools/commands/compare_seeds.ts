// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from '@commander-js/extra-typings';
import { promises as fs } from 'fs';
import { VariationsSeed } from '../../proto/generated/variations_seed';
import diffStrings from '../utils/diff_strings';

export default function createCommand() {
  return new Command('compare_seeds')
    .description('Compare two seed.bin')
    .argument('<seed1_file>', 'seed1 file')
    .argument('<seed2_file>', 'seed2 file')
    .argument('<seed1_serialnumber>', 'seed1 serialnumber file')
    .argument('<seed2_serialnumber>', 'seed2 serialnumber file')
    .action(main);
}

async function main(
  seed1FilePath: string,
  seed2FilePath: string,
  seed1SerialnumberFilePath: string,
  seed2SerialnumberFilePath: string,
) {
  const seed1Binary: Buffer = await fs.readFile(seed1FilePath);
  const seed2Binary: Buffer = await fs.readFile(seed2FilePath);
  const seed1Content = VariationsSeed.fromBinary(seed1Binary);
  const seed2Content = VariationsSeed.fromBinary(seed2Binary);

  const seed1Json = VariationsSeed.toJson(seed1Content, {
    emitDefaultValues: false,
    enumAsInteger: false,
    useProtoFieldName: true,
  });

  const seed2Json = VariationsSeed.toJson(seed2Content, {
    emitDefaultValues: false,
    enumAsInteger: false,
    useProtoFieldName: true,
  });

  const seed1JsonString = JSON.stringify(seed1Json, null, 2);
  const seed2JsonString = JSON.stringify(seed2Json, null, 2);

  if (seed1JsonString !== seed2JsonString) {
    console.error('Seeds are different');
    console.error(
      await diffStrings(
        seed1JsonString,
        seed2JsonString,
        seed1FilePath,
        seed2FilePath,
      ),
    );
    process.exit(1);
  }

  if (!seed1Binary.equals(seed2Binary)) {
    console.error('Seeds semantically equal but binary different');
    process.exit(1);
  }

  const seed1Serialnumber: string = await fs.readFile(
    seed1SerialnumberFilePath,
    'utf8',
  );
  const seed2Serialnumber: string = await fs.readFile(
    seed2SerialnumberFilePath,
    'utf8',
  );
  if (seed1Content.serial_number !== seed1Serialnumber) {
    console.error('Seed1 serial number does not match');
    process.exit(1);
  }
  if (seed2Content.serial_number !== seed2Serialnumber) {
    console.error('Seed2 serial number does not match');
    process.exit(1);
  }

  console.log('Seeds are equal');
}
