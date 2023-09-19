// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

export enum SeedType {
  PRODUCTION, // production Brave seed (brave-variations@production)
  STAGING, // staging Brave seed (brave-variations@main)
  UPSTREAM, // Chrome seed (Finch)
}

export class ProcessingOptions {
  // The Chromium used by the current stable Brave (i.e. cr117). Usually is
  // taken from API.
  // Studies that target to older versions are considered as outdated.
  minMajorVersion: number;
}
