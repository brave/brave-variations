import { type variations as proto } from '../proto/generated/proto_bundle';
import {
  type ProcessedStudy,
  StudyPriority,
  processStudyList,
  priorityToDescription,
} from './study_classifier';
import { type ProcessingOptions } from './core_utils';

class SummaryItem {
  priority: StudyPriority;
  studyName: string;
  short_description: string;
  affectedFeatures = new Set<string>();
  description: string;
}

function getOverallPriority(studies: ProcessedStudy[]): StudyPriority {
  let priority = StudyPriority.NON_INTERESTING;
  for (const study of studies) {
    const p = study.priorityDetails.getOverallPriority();
    if (p > priority) priority = p;
  }

  return priority;
}

export function makeSummary(
  oldSeed: proto.VariationsSeed,
  newSeed: proto.VariationsSeed,
  options: ProcessingOptions,
): SummaryItem[] {
  const summary: SummaryItem[] = [];
  const oldMap = processStudyList(
    oldSeed.study,
    StudyPriority.STABLE_MIN,
    options,
  );
  const newMap = processStudyList(
    newSeed.study,
    StudyPriority.STABLE_MIN,
    options,
  );

  const visitedKeys = new Set<string>();

  const checkKey = (key: string): void => {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);

    const oldStudy: ProcessedStudy[] = oldMap.get(key) ?? [];
    const newStudy: ProcessedStudy[] = newMap.get(key) ?? [];
    const isChanged = JSON.stringify(oldStudy) !== JSON.stringify(newStudy);

    const oldPriority = getOverallPriority(oldStudy);
    const newPriority = getOverallPriority(newStudy);
    const priority = Math.max(oldPriority, newPriority);

    const item = new SummaryItem();
    item.priority = priority;
    item.studyName = key;
    for (const study of oldStudy.concat(newStudy))
      study.affectedFeatures.forEach((v) => item.affectedFeatures.add(v));

    if (newPriority > oldPriority) {
      if (oldPriority < StudyPriority.STABLE_MIN) {
        item.short_description = 'New';
        item.description = 'A new exp ' + priorityToDescription(priority);
      } else {
        item.short_description = 'Audience up';
        item.description =
          'A known exp now ' +
          priorityToDescription(newPriority) +
          `(was: ${priorityToDescription(oldPriority)})`;
      }
    } else if (newPriority < oldPriority) {
      if (newPriority < StudyPriority.STABLE_MIN) {
        item.short_description = 'Removed';
        item.description = `A known exp have been removed (was: ${priorityToDescription(
          oldPriority,
        )})`;
      } else {
        item.short_description = 'Audience down';
        // console.log(oldPriority)
        item.description =
          'A known exp now ' +
          priorityToDescription(newPriority) +
          `(was: ${priorityToDescription(oldPriority)})`;
      }
    } else {
      if (isChanged) {
        item.short_description = 'Change';
        item.description = 'The exp has been changed, the audience is similar';
      } else {
        return;
      }
    }
    summary.push(item);
  };
  for (const key of newMap.keys()) checkKey(key);

  for (const key of oldMap.keys()) checkKey(key);

  return summary;
}

export function summaryToText(summary: SummaryItem[]): string {
  summary.sort((a, b) => b.priority - a.priority);
  let output = '';
  for (const e of summary) {
    // TODO
    const f = Array.from(e.affectedFeatures).join(',');
    output += `${e.priority} [${e.short_description}]\t ${e.studyName} ${f} ${e.description}\n`;
  }
  return output;
}
