// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import * as fs from 'fs-extra';
import * as path from 'path';
import { Study } from '../proto/generated/study';

function jsonStudyReplacer(key: string, value: any): any {
  if (key === 'start_date' || key === 'end_date') {
    return new Date(parseInt(value) * 1000).toISOString();
  }

  if (key === 'channel') {
    return value.map((value: string): string => {
      switch (value) {
        case 'CANARY':
          return 'NIGHTLY';
        case 'STABLE':
          return 'RELEASE';
      }
      return value;
    });
  }

  return value;
}

function jsonStudyReviever(key: string, value: any): any {
  if (key === 'start_date' || key === 'end_date') {
    const isIsoString =
      typeof value === 'string' &&
      value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/) !== null;
    if (!isIsoString) {
      throw new Error(
        `Invalid ${key} value "${value}", only ISO format is valid`,
      );
    }
    return Math.floor(new Date(value).getTime() / 1000).toString();
  }

  if (key === 'channel') {
    return value.map((value: string): string => {
      switch (value) {
        case 'NIGHTLY':
          return 'CANARY';
        case 'RELEASE':
          return 'STABLE';
      }
      return value;
    });
  }

  return value;
}

export function writeStudyArray(studyArray: Study[], studyFile: string) {
  fs.writeJSONSync(studyFile, studyArray, {
    spaces: 2,
    replacer: jsonStudyReplacer,
  });
}

export function readStudyArray(studyFile: string): Study[] {
  const jsonStudies = fs.readJSONSync(studyFile, {
    reviver: jsonStudyReviever,
  });
  const studyFileBaseName = path.basename(studyFile, '.json');
  const studyArray = [];
  for (const jsonStudy of jsonStudies) {
    const parsedStudy = Study.fromJson(jsonStudy, {
      ignoreUnknownFields: false,
    });
    if (parsedStudy.name !== studyFileBaseName) {
      throw new Error(
        `Study name "${parsedStudy.name}" does not match file name "${studyFileBaseName}"`,
      );
    }
    studyArray.push(parsedStudy);
  }

  return studyArray;
}
