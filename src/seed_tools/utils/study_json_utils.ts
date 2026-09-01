// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { promises as fs } from 'fs';
import JSON5 from 'json5';
import { Study } from '../../proto/generated/study';
import * as converters from './converters';

export interface Options {
  isChromium?: boolean;
}

// Extracts the leading `// ! ...` comments from the study file content.
export function extractStudyFileHeader(content: string): string {
  const STUDY_FILE_HEADER_PATTERN = /^(?:\/\/ !.*\n)+/;
  return STUDY_FILE_HEADER_PATTERN.exec(content)?.[0] ?? '';
}

export function parseStudyFileHeader(content: string): {
  expireDate?: Date;
} {
  const header = extractStudyFileHeader(content);
  let expireDate: Date | undefined = undefined;
  for (const line of header.split('\n')) {
    const EXPIRE_DATE_PREFIX = '// !Expire date:';
    if (line.startsWith(EXPIRE_DATE_PREFIX)) {
      const value = line.slice(EXPIRE_DATE_PREFIX.length).trim();
      expireDate = new Date(value);
      if (Number.isNaN(expireDate.getTime())) {
        throw new Error(`Invalid Expire date value "${value}"`);
      }
    }
  }
  return { expireDate };
}

export function parseStudyFile(
  studyFilePath: string,
  studyFileContent: string,
  options?: Options,
): {
  studies: Study[];
  errors: string[];
  expireDate?: Date;
} {
  let studies: Study[] = [];
  try {
    const { expireDate } = parseStudyFileHeader(studyFileContent);
    studies = parseStudies(studyFileContent, options);
    return { studies, errors: [], expireDate };
  } catch (e) {
    if (e instanceof Error) {
      e.message += ` (${studyFilePath})`;
      return {
        studies,
        errors: [e.message],
      };
    }
    // Rethrow non-Error exceptions.
    throw e;
  }
}

export async function writeStudyFile(
  studies: Study[],
  studyFilePath: string,
  options?: Options,
) {
  await fs.writeFile(studyFilePath, stringifyStudies(studies, options));
}

export function parseStudies(
  studyArrayString: string,
  options?: Options,
): Study[] {
  const jsonStudies = JSON5.parse(
    studyArrayString,
    jsonStudyReviver.bind(null, options),
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

export function stringifyStudies(studies: Study[], options?: Options): string {
  const jsonStudies: any[] = [];
  for (const study of studies) {
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
    JSON5.stringify(jsonStudies, jsonStudyReplacer.bind(null, options), 2) +
    '\n'
  );
}

export function stringifyStudyFile(
  studies: Study[],
  originalContent: string,
  options?: Options,
): string {
  return (
    extractStudyFileHeader(originalContent) + stringifyStudies(studies, options)
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
    case 'channel': {
      return value.map((c: string) =>
        converters.channelToString(c, options?.isChromium === true),
      );
    }
    case 'platform': {
      return value.map(converters.platformToString);
    }
    default:
      return value;
  }
}

function jsonStudyReviver(
  options: Options | undefined,
  key: string,
  value: any,
): any {
  switch (key) {
    case 'start_date':
    case 'end_date': {
      const isIsoString =
        typeof value === 'string' &&
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(value);
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
      return value.map(converters.stringToChannel);
    case 'platform':
      if (options?.isChromium === true) {
        return value;
      }
      return value.map(converters.stringToPlatform);
    default:
      return value;
  }
}
