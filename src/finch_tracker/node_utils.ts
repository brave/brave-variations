import * as https from 'https';
import * as path from 'path'

export async function downloadUrl(url: string): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const data: any = [];
    https.get(url, (res: any) => {

      res.on('data', (chunk: any) => data.push(chunk));
      res.on('end', () => { resolve(Buffer.concat(data)); });
    }
    ).on('error', reject);
  });
}

export function getSeedPath(storageDir: string): string {
  return path.join(storageDir, 'seed.bin');
}

export function getStudyPath(storageDir: string): string {
  return path.join(storageDir, 'study');
}
