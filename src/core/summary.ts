// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.
import { type variations as proto } from '../proto/generated/proto_bundle';
import {
  type ProcessedStudy,
  StudyPriority,
  processStudyList,
  priorityToText,
} from './study_processor';
import { createHash } from 'node:crypto';
import * as utils from './core_utils';
import * as config from '../config';

enum ItemAction {
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
  description: string;

  oldPriority: StudyPriority;
  newPriority: StudyPriority;

  oldAudience: number;
  newAudience: number;

  getChangePriority(): StudyPriority {
    return Math.max(this.oldPriority, this.newPriority);
  }

  isNewKillSwitch(): boolean {
    return (
      this.newPriority === StudyPriority.STABLE_ALL_EMERGENCY &&
      this.action !== ItemAction.RemovedOrOutdated
    );
  }

  actionToText(): string {
    if (this.isNewKillSwitch()) return ':zap:';

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
  oldSeed: proto.VariationsSeed,
  newSeed: proto.VariationsSeed,
  options: utils.ProcessingOptions,
  minPriority: StudyPriority,
): Map<StudyPriority, SummaryItem[]> {
  const summary = new Map<StudyPriority, SummaryItem[]>();
  const oldMap = processStudyList(oldSeed.study, minPriority, options);
  const newMap = processStudyList(newSeed.study, minPriority, options);

  const visitedKeys = new Set<string>();

  const checkKey = (key: string): void => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);

    const oldStudy: ProcessedStudy[] = oldMap.get(key) ?? [];
    const newStudy: ProcessedStudy[] = newMap.get(key) ?? [];
    const isChanged = JSON.stringify(oldStudy) !== JSON.stringify(newStudy);

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
      if (isChanged) {
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
  const path = `study/all-by-name/${study}`;
  const pathHash = sha256(path);
  return `${utils.getGitHubStorageUrl()}/commit/${commit}#diff-${pathHash}`;
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

export function summaryToJson(
  summary: Map<StudyPriority, SummaryItem[]>,
  newGitSha1?: string,
): string | undefined {
  const output = new MrkdwnMessage();
  let hasNewKillSwitches = false;

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
      hasNewKillSwitches ||= e.isNewKillSwitch();
      const f = affectedFeaturesToText(e.affectedFeatures);
      const block = new TextBlock(e.actionToText());
      block.addLink(utils.getGriffinUiUrl(e.studyName), e.studyName);
      block.addLink(
        utils.getGitHubStudyConfigUrl(e.studyName, utils.SeedType.UPSTREAM),
        'Config',
      );
      if (newGitSha1 !== undefined) {
        block.addLink(
          getGitHubDiffUrl(e.studyName, e.oldPriority, newGitSha1),
          'Diff',
        );
      }
      const space = '        ';
      block.add(`\\n${space}priority: ${e.oldPriority}→${e.newPriority}`);
      block.add(
        `, audience: ${(e.oldAudience * 100).toFixed(0)}%` +
          `→${(e.newAudience * 100).toFixed(0)}%`,
      );
      block.add(`\\n${space}features:${f}`);
      output.addBlock(block);
    }
    output.addDivider();
  }
  if (output.toString() === '') return undefined;

  output.addHeader('New finch changes detected');

  if (hasNewKillSwitches) {
    output.addBlock(
      new TextBlock(
        'cc ' + config.killSwitchNotificationIds.map((i) => `<@${i}>`).join(),
      ),
    );
  }
  return `{
    "text": "New finch changes detected",
    "blocks": [
      ${output.toString()}
    ]
  }`;
}
