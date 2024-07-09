// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

export interface VersionOptions {
  disallowLeadingZeros?: boolean;
  disallowWildcard?: boolean;
}

// Represents a version string that may contain a wildcard.
export class Version {
  public readonly components: readonly number[];
  public readonly isWildcard: boolean;

  constructor(versionStr: string, options?: VersionOptions) {
    [this.components, this.isWildcard] = this.parseVersionString(
      versionStr,
      options,
    );
  }

  private parseVersionString(
    versionStr: string,
    options?: VersionOptions,
  ): [number[], boolean] {
    const components: number[] = [];
    let isWildcard = false;
    if (versionStr === undefined || versionStr === '') {
      throw new Error(`Invalid version: ${versionStr}`);
    }

    const splittedVersionStr = versionStr.split('.');
    for (const strComponent of splittedVersionStr) {
      if (isWildcard) {
        throw new Error(
          `.* should not be followed by any other component: ${versionStr}`,
        );
      }

      if (options?.disallowWildcard !== true && strComponent === '*') {
        if (components.length === 0) {
          throw new Error(`* should not be the first component: ${versionStr}`);
        }
        isWildcard = true;
        continue;
      }

      const parsedComponentResult = parseVersionComponent(strComponent);
      if (parsedComponentResult instanceof Error) {
        throw new Error(`${parsedComponentResult.message}: ${versionStr}`);
      }

      const parsedComponent = parsedComponentResult;
      // base::Version allows leading zeros in subsequent parts (but not the
      // first) for legacy reasons. This is not necessary for our use case, so
      // we can forbid them.
      if (
        (components.length === 0 || options?.disallowLeadingZeros === true) &&
        parsedComponent.toString() !== strComponent
      ) {
        throw new Error(`Leading zeros are not allowed: ${versionStr}`);
      }

      components.push(parsedComponent);
    }

    return [components, isWildcard];
  }

  compare(other: Version): number {
    const minLen = Math.min(this.components.length, other.components.length);

    for (let i = 0; i < minLen; i++) {
      if (this.components[i] > other.components[i]) {
        return 1;
      } else if (this.components[i] < other.components[i]) {
        return -1;
      }
    }

    if (this.isWildcard || other.isWildcard) {
      return 0;
    }

    if (this.components.length > other.components.length) {
      for (let i = minLen; i < this.components.length; i++) {
        if (this.components[i] > 0) return 1;
      }
    } else if (this.components.length < other.components.length) {
      for (let i = minLen; i < other.components.length; i++) {
        if (other.components[i] > 0) return -1;
      }
    }
    return 0;
  }

  lt(other: Version): boolean {
    return this.compare(other) < 0;
  }

  lte(other: Version): boolean {
    return this.compare(other) <= 0;
  }

  gt(other: Version): boolean {
    return this.compare(other) > 0;
  }

  gte(other: Version): boolean {
    return this.compare(other) >= 0;
  }

  eq(other: Version): boolean {
    return this.compare(other) === 0;
  }

  toString(): string {
    return (
      this.components.join('.') +
      (this.components.length > 0 && this.isWildcard ? '.*' : '')
    );
  }
}

// Strictly parse a string as a number that can be represented as uint32. This
// is required to match the behavior of base::Version in C++.
function parseVersionComponent(str: string): number | Error {
  if (!/^\d+$/.test(str)) {
    return new Error(
      `Version component "${str}" contains non-numeric characters`,
    );
  }

  const num = parseInt(str, 10);

  if (num < 0 || num > 4294967295) {
    return new Error(`Version component "${str}" does not fit into uint32`);
  }

  return num;
}
