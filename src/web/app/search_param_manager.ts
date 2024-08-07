// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { type SetURLSearchParams } from 'react-router-dom';

import { SeedType } from '../../core/base_types';
import { StudyFilter, StudyPriority } from '../../core/study_processor';

function stringToSeedType(value: string): SeedType | undefined {
  const index = Object.values(SeedType).indexOf(value);
  if (index >= 0) {
    return index as SeedType;
  }
  return undefined;
}

export class SearchParamManager {
  readonly filter: StudyFilter;
  readonly currentSeed: SeedType;
  private readonly setParams: (params: Record<string, string | null>) => void;

  constructor(params: [URLSearchParams, SetURLSearchParams]) {
    const searchParams = params[0];
    const setSearchParams = params[1];
    this.setParams = (params: Record<string, string | null>) => {
      setSearchParams((prev) => {
        for (const [key, value] of Object.entries(params)) {
          if (value != null) prev.set(key, value);
          else prev.delete(key);
        }
        return prev;
      });
    };

    const filter = new StudyFilter();
    filter.search = searchParams.get('search') ?? undefined;
    this.currentSeed =
      stringToSeedType(searchParams.get('seed') ?? 'MAIN') ?? SeedType.MAIN;
    filter.minPriority =
      this.currentSeed === SeedType.UPSTREAM
        ? StudyPriority.STABLE_MIN
        : StudyPriority.NON_INTERESTING;
    try {
      const priorityString = searchParams.get('minPriority');
      if (priorityString != null) {
        filter.minPriority = parseInt(priorityString);
      }
    } catch {
      /* empty */
    }
    filter.showEmptyGroups = searchParams.get('showEmptyGroups') === 'true';
    filter.includeOutdated = searchParams.get('includeOutdated') === 'true';
    this.filter = filter;
  }

  toggleShowEmptyGroups() {
    this.setParams({
      showEmptyGroups: this.filter.showEmptyGroups ? null : 'true',
    });
  }

  toggleIncludeOutdated() {
    this.setParams({
      includeOutdated: this.filter.includeOutdated ? null : 'true',
    });
  }

  setMinPriority(minPriority: number) {
    this.setParams({
      minPriority: minPriority.toString(),
    });
  }

  setSearch(value: string) {
    this.setParams({
      search: value === '' ? null : value,
    });
  }

  setSeedType(type: SeedType) {
    this.setParams({ seed: SeedType[type], search: null });
  }
}
