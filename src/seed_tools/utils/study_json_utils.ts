// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { promises as fs } from 'fs';
import Result from 'src/base/result';
import { Study } from '../../proto/generated/study';

export interface Options {
  isChromium?: boolean;
}

export async function readStudyFile(
  studyFilePath: string,
  options?: Options,
): Promise<Study[]> {
  const result = await readStudyFileReturnWithError(studyFilePath, options);
  if (result.ok) {
    return result.value[0];
  } else {
    throw result.error;
  }
}

export async function readStudyFileReturnWithError(
  studyFilePath: string,
  options?: Options,
): Promise<Result<[Study[], string], Error>> {
  try {
    const studyArrayString = await fs.readFile(studyFilePath, 'utf8');
    const studyArray = parseStudyArray(studyArrayString, options);
    return Result.ok([studyArray, studyArrayString]);
  } catch (e) {
    if (e instanceof Error) {
      e.message += ` (${studyFilePath})`;
      return Result.error(e);
    }
    // Rethrow non-Error exceptions.
    throw e;
  }
}

export async function writeStudyFile(
  studyArray: Study[],
  studyFilePath: string,
  options?: Options,
) {
  await fs.writeFile(studyFilePath, stringifyStudyArray(studyArray, options));
}

export function parseStudyArray(
  studyArrayString: string,
  options?: Options,
): Study[] {
  const jsonStudies = JSON.parse(
    studyArrayString,
    jsonStudyReviever.bind(null, options),
  );
  if (!Array.isArray(jsonStudies)) {
    throw new Error('Root element must be an array');
  }

  const studyArray = [];
  for (const jsonStudy of jsonStudies) {
    const parsedStudy = Study.fromJson(jsonStudy, {
      ignoreUnknownFields: false,
    });
    studyArray.push(parsedStudy);
  }

  return studyArray;
}

export function stringifyStudyArray(
  studyArray: Study[],
  options?: Options,
): string {
  const jsonStudies: any[] = [];
  for (const study of studyArray) {
    const jsonStudy = Study.toJson(study, {
      emitDefaultValues: false,
      enumAsInteger: false,
      useProtoFieldName: true,
    });
    jsonStudies.push(jsonStudy);
  }

  // Use 2 spaces for indentation and add a newline at the end to match Prettier
  // `json-stringify` behaviour.
  return (
    JSON.stringify(jsonStudies, jsonStudyReplacer.bind(null, options), 2) + '\n'
  );
}

function jsonStudyReplacer(
  options: Options | undefined,
  key: string,
  value: any,
): any {
  switch (key) {
    case 'start_date':
    case 'end_date': {
      return new Date(value * 1000).toISOString();
    }
    case 'channel':
      if (options?.isChromium === true) {
        return value;
      }
      return value.map((value: string): string => {
        switch (value) {
          case 'CANARY':
            return 'NIGHTLY';
          case 'STABLE':
            return 'RELEASE';
        }
        return value;
      });
    default:
      return value;
  }
}

function jsonStudyReviever(
  options: Options | undefined,
  key: string,
  value: any,
): any {
  switch (key) {
    case 'start_date':
    case 'end_date': {
      const isIsoString =
        typeof value === 'string' &&
        value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/) !== null;
      if (!isIsoString) {
        throw new Error(
          `Invalid ${key} value "${value}", only ISO format with Z timezone is supported`,
        );
      }
      return Math.floor(new Date(value).getTime() / 1000).toString();
    }
    case 'channel':
      if (options?.isChromium === true) {
        return value;
      }
      return value.map((value: string): string => {
        switch (value) {
          case 'NIGHTLY':
            return 'CANARY';
          case 'RELEASE':
            return 'STABLE';
        }
        return value;
      });
    default:
      return value;
  }
}
