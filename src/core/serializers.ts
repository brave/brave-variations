import { variations as proto } from '../proto/generated/proto_bundle';

function secondToUTCString(unixTimeSeconds: number): string {
  return (new Date(unixTimeSeconds * 1000)).toUTCString();
}

export function serializePlatforms(platforms?: string[]): string | undefined {
  if (platforms === undefined) return undefined;
  return platforms.map((v) => v.substring(9)).join(', ');
}

export function serializeChannels(channels?: string[]): string | undefined {
  if (channels === undefined) return undefined;
  return channels.join(', ');
}

export function studyToJSON(study: proto.IStudy): Record<string, any> {
  const msg = proto.Study.fromObject(study);
  const json = msg.toJSON();
  const filter = json.filter;
  delete json.consistency;
  delete json.activation_type;
  if (filter !== undefined) {
    if (filter.end_date !== undefined)
      filter.end_date = secondToUTCString(filter.end_date);
    if (filter.start_date !== undefined) {
      filter.start_date = secondToUTCString(filter.start_date);
    }
    filter.platform = serializePlatforms(filter.platform);
    filter.channel = serializeChannels(filter.channel);
  }
  return json;
}
