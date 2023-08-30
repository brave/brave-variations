import * as config from '../blocklist.config'

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

const gStudyBlocklist = new Blocklist(config.blocklistedStudies);
const gFeatureBlocklist = new Blocklist(config.blocklistedFeatures);

export function isStudyNameBlocklisted(studyName: string): boolean {
  return gStudyBlocklist.matches(studyName);
}

export function isFeatureBlocklisted(featureName: string): boolean {
  return gFeatureBlocklist.matches(featureName);
}
