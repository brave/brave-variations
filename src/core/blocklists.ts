import * as fs from 'fs';

function readlinesFromFile(filename: string): string[] {
  const fileContent = fs.readFileSync(filename, { encoding: 'utf-8' });
  return fileContent.split('\n');
}

class Blocklist {
  private readonly regexps: RegExp[] = [];

  constructor(patterns: string[]) {
    for (const line of patterns) {
      if (line === '') continue;
      const len = line.length;
      if (len > 2 && line[0] === '/' && line[len - 1] === '/') {
        this.regexps.push(new RegExp(line.substring(1, len - 2)));
      } else {
        this.regexps.push(new RegExp(`^${line}$`));
      }
    }
  }

  matches(str: string): boolean {
    return this.regexps.find((v) => v.test(str)) !== undefined;
  }
}

const gStudyBlocklist = new Blocklist(readlinesFromFile('core/blocklists/study_blocklist.txt'));
const gFeatureBlocklist = new Blocklist(readlinesFromFile('core/blocklists/feature_blocklist.txt'));

export function isStudyNameBlocklisted(studyName: string): boolean {
  return gStudyBlocklist.matches(studyName);
}

export function isFeatureBlocklisted(featureName: string): boolean {
  return gFeatureBlocklist.matches(featureName);
}
