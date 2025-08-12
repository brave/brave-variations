// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { createHash } from 'node:crypto';

import { SeedType, type ProcessingOptions } from './base_types';
import {
  StudyPriority,
  priorityToText,
  processStudyList,
  type ProcessedStudy,
} from './study_processor';

import config from '../config';
import { VariationsSeed } from '../proto/generated/variations_seed';
import * as url_utils from './url_utils';

export enum ItemAction {
  New,
  Up,
  Change,
  Down,
  RemovedOrOutdated,
}
class SummaryItem {
  studyName: string;
  action: ItemAction;
  affectedFeatures = new Set<string>();

  oldPriority: StudyPriority;
  newPriority: StudyPriority;

  oldAudience: number;
  newAudience: number;

  hasOnlyDisabledFeatures: boolean;
  hasBadStudies: boolean;

  getChangePriority(): StudyPriority {
    if (this.isKillSwitchImportantUpdate()) {
      return StudyPriority.STABLE_EMERGENCY_KILL_SWITCH;
    }
    return Math.max(this.oldPriority, this.newPriority);
  }

  isKillSwitchImportantUpdate(): boolean {
    if (
      this.newPriority === StudyPriority.STABLE_ALL &&
      this.oldPriority < StudyPriority.STABLE_MIN &&
      this.newAudience === 1
    ) {
      // 0% => 100% change with disabled feature, consider it as a kill switch.
      if (this.hasOnlyDisabledFeatures) return true;
    }
    return (
      this.newPriority === StudyPriority.STABLE_EMERGENCY_KILL_SWITCH &&
      this.action !== ItemAction.Down &&
      this.action !== ItemAction.RemovedOrOutdated
    );
  }

  actionToText(): string {
    if (this.isKillSwitchImportantUpdate()) return ':warning:';

    switch (this.action) {
      case ItemAction.New:
        return ':new:';
      case ItemAction.Up:
        return ':arrow_up:';
      case ItemAction.Change:
        return ':twisted_rightwards_arrows:';
      case ItemAction.Down:
        return ':arrow_down:';
      case ItemAction.RemovedOrOutdated:
        return ':negative_squared_cross_mark:';
    }
    return '';
  }
}

function getOverallPriority(studies: ProcessedStudy[]): StudyPriority {
  let priority = StudyPriority.NON_INTERESTING;
  for (const study of studies) {
    const p = study.studyDetails.getPriority();
    if (p > priority) priority = p;
  }

  return priority;
}

function hasOnlyDisabledFeatures(studies: ProcessedStudy[]): boolean {
  return (
    studies.find((s) => !s.studyDetails.onlyDisabledFeatures) === undefined
  );
}

function getOverallAudience(
  studies: ProcessedStudy[],
  priority: StudyPriority,
): number {
  let maxAudience = 0;
  for (const study of studies) {
    const p = study.studyDetails.getPriority();
    if (p === priority && study.studyDetails.totalWeight !== 0) {
      maxAudience = Math.max(
        maxAudience,
        study.studyDetails.totalNonDefaultGroupsWeight /
          study.studyDetails.totalWeight,
      );
    }
  }

  return maxAudience;
}

export function makeSummary(
  oldSeed: VariationsSeed,
  newSeed: VariationsSeed,
  options: ProcessingOptions,
  minPriority: StudyPriority,
): Map<StudyPriority, SummaryItem[]> {
  const summary = new Map<StudyPriority, SummaryItem[]>();
  const oldMap = processStudyList(oldSeed.study, minPriority, options);
  const newMap = processStudyList(newSeed.study, minPriority, options);

  const visitedKeys = new Set<string>();

  const checkKey = (key: string) => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);

    const oldStudy: ProcessedStudy[] = oldMap.get(key) ?? [];
    const newStudy: ProcessedStudy[] = newMap.get(key) ?? [];
    const isEqual =
      oldStudy.length == newStudy.length &&
      oldStudy.every((v, i) => v.equals(newStudy[i]));

    const item = new SummaryItem();
    item.oldPriority = getOverallPriority(oldStudy);
    item.newPriority = getOverallPriority(newStudy);
    item.oldAudience = getOverallAudience(
      oldStudy,
      Math.max(item.oldPriority, minPriority),
    );
    item.newAudience = getOverallAudience(
      newStudy,
      Math.max(item.newPriority, minPriority),
    );

    item.hasOnlyDisabledFeatures = hasOnlyDisabledFeatures(newStudy);
    item.hasBadStudies =
      newStudy.find((v) => v.studyDetails.isBadStudyFormat) !== undefined;

    const changePriority = item.getChangePriority();
    if (changePriority < minPriority) return;

    item.studyName = key;
    for (const study of oldStudy.concat(newStudy))
      study.affectedFeatures.forEach((v) => item.affectedFeatures.add(v));

    if (item.newPriority > item.oldPriority) {
      if (item.oldPriority < minPriority) {
        item.action = ItemAction.New;
      } else {
        item.action = ItemAction.Up;
      }
    } else if (item.newPriority < item.oldPriority) {
      if (item.newPriority < minPriority) {
        item.action = ItemAction.RemovedOrOutdated;
      } else {
        item.action = ItemAction.Down;
      }
    } else {
      if (!isEqual) {
        item.action = ItemAction.Change;
      } else {
        return;
      }
    }
    let itemList = summary.get(changePriority);
    if (itemList === undefined) {
      itemList = [];
      summary.set(changePriority, itemList);
    }
    itemList.push(item);
  };
  for (const key of newMap.keys()) checkKey(key);
  for (const key of oldMap.keys()) checkKey(key);

  return summary;
}

function affectedFeaturesToText(features: Set<string>): string {
  let output = '';
  let count = 0;
  const kMaxLength = 40;
  for (const f of features) {
    if (count >= 3 || output.length > kMaxLength) break;
    if (output !== '') output += ', ';
    output += '`' + f + '`';
    count++;
  }
  const delta = features.size - count;
  if (delta > 0) {
    output += ', ..' + delta.toFixed() + ' others';
  }
  return output;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function getGitHubDiffUrl(
  study: string,
  oldPriority: StudyPriority,
  commit: string,
): string {
  const path = `study/all-by-name/${study}.json5`;
  const pathHash = sha256(path);
  return `${url_utils.getGitHubStorageUrl()}/commit/${commit}#diff-${pathHash}`;
}

class TextBlock {
  private content = '';

  constructor(content: string) {
    this.content = content;
  }

  addLink(link: string, title: string): void {
    this.content += ` <${link}|${title}>`;
  }

  add(text: string): void {
    this.content += text;
  }

  toString(): string {
    return `{"type":"section","text":{"type":"mrkdwn","text":"${this.content}"}}`;
  }
}

class MrkdwnMessage {
  private context = '';
  addBlock(block: TextBlock): void {
    if (this.context !== '') this.context += ',\n';
    this.context += block.toString();
  }

  addBlockToTop(block: TextBlock): void {
    this.context =
      block.toString() + (this.context !== '' ? ',\n' : '') + this.context;
  }

  addHeader(text: string): void {
    this.context =
      `{"type":"header","text":{"type":"plain_text","text":"${text}"}},\n` +
      this.context;
  }

  addDivider(): void {
    if (this.context !== '') this.context += ',\n';
    this.context += '{"type": "divider"}';
  }

  toString(): string {
    return this.context;
  }
}

class Alert {
  description: string;
  ids: string[];
  killSwitch?: boolean;
  processingError?: boolean;
  features?: string[];
}

export function summaryToJson(
  summary: Map<StudyPriority, SummaryItem[]>,
  newGitSha1?: string,
): string | undefined {
  const output = new MrkdwnMessage();

  const alerts = new Set<Alert>();

  // From the highest to the lowest priority:
  const priorityList = Object.values(StudyPriority)
    .filter((v): v is StudyPriority => {
      return typeof v !== 'string';
    })
    .reverse();

  for (const priority of priorityList) {
    const itemList = summary.get(priority);
    if (itemList === undefined || itemList.length === 0) continue;

    output.addBlock(
      new TextBlock(`*Priority ${priority} [${priorityToText(priority)}]*`),
    );
    itemList.sort((a, b) => a.action - b.action);
    for (const e of itemList) {
      for (const f of e.affectedFeatures) {
        config.alerts.forEach((alert) => {
          if (alert.features?.includes(f)) {
            alerts.add(alert);
          }
        });
      }
      config.alerts.forEach((alert) => {
        if (alert.killSwitch && e.isKillSwitchImportantUpdate()) {
          alerts.add(alert);
        }
        if (alert.processingError && e.hasBadStudies) {
          alerts.add(alert);
        }
      });

      const block = new TextBlock(e.actionToText());
      block.addLink(url_utils.getGriffinUiUrl(e.studyName), e.studyName);
      block.addLink(
        url_utils.getStudyRawConfigUrl(e.studyName, SeedType.UPSTREAM),
        'Config',
      );
      if (newGitSha1 !== undefined) {
        block.addLink(
          getGitHubDiffUrl(e.studyName, e.oldPriority, newGitSha1),
          'Diff',
        );
      }
      const showOldPriority =
        e.newPriority !== e.oldPriority && e.action !== ItemAction.New;
      const showOldAudience =
        e.newAudience !== e.oldAudience && e.action !== ItemAction.New;
      block.add(
        ' ' +
          (showOldPriority ? `P${e.oldPriority}→` : '') +
          `P${e.newPriority}`,
      );
      block.add(
        `, :bust_in_silhouette:` +
          (showOldAudience ? `${(e.oldAudience * 100).toFixed(0)}%→` : ``) +
          `${(e.newAudience * 100).toFixed(0)}%`,
      );
      if (priority >= StudyPriority.STABLE_ALL)
        block.add(` ${affectedFeaturesToText(e.affectedFeatures)}`);
      output.addBlock(block);
    }
    output.addDivider();
  }
  if (output.toString() === '') return undefined;

  alerts.forEach((alert) => {
    output.addBlockToTop(
      new TextBlock(
        alert.description + ', cc ' + alert.ids.map((i) => `<@${i}>`).join(),
      ),
    );
  });
  return `{
    "channel" : "${config.channelId}",
    "text": "New finch changes detected",
    "blocks": [
      ${output.toString()}
    ]
  }`;
}
