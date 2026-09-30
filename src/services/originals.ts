import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { createPrivateAssetUrl } from '../data/journalRepository';
import type { JournalEntry } from '../types';

export type PreservedOriginal = {
  uri?: string;
  status: 'device_private' | 'session' | 'demo' | 'unavailable';
};

export function hasViewableOriginal(entry: Pick<JournalEntry, 'originalImageUri' | 'originalImageStatus' | 'photoDeleted'>): boolean {
  const status = entry.originalImageStatus ?? (entry.photoDeleted ? 'deleted' : 'unavailable');
  return Boolean(entry.originalImageUri) && (status === 'device_private' || status === 'session');
}

export function hasStoredOriginal(entry: Pick<JournalEntry, 'originalAsset' | 'originalImageUri' | 'originalImageStatus' | 'photoDeleted'>): boolean {
  return hasViewableOriginal(entry)
    || (entry.originalImageStatus === 'cloud_private' && Boolean(entry.originalAsset));
}

export async function resolveOriginalImageUri(
  entry: Pick<JournalEntry, 'originalAsset' | 'originalImageUri'>,
  expiresInSeconds = 5 * 60,
) {
  if (entry.originalImageUri) return entry.originalImageUri;
  if (!entry.originalAsset) throw new Error('Original image is not available.');
  return createPrivateAssetUrl(
    entry.originalAsset.bucketId,
    entry.originalAsset.objectPath,
    expiresInSeconds,
  );
}

export async function preserveOriginalImage(uri: string | undefined, id: string): Promise<PreservedOriginal> {
  if (!uri || uri.startsWith('demo://')) return { status: 'demo' };

  // Browser object URLs are only suitable for the current preview session.
  // Native builds move the capture into the app-private documents directory.
  if (Platform.OS === 'web') return { uri, status: 'session' };

  try {
    const originals = new Directory(Paths.document, 'visual-gut-journal', 'originals');
    originals.create({ idempotent: true, intermediates: true });
    const source = new File(uri);
    const destination = new File(originals, `${id}${source.extension || '.jpg'}`);
    await source.move(destination, { overwrite: true });
    return { uri: source.uri, status: 'device_private' };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function permanentlyDeleteOriginalImage(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    return true;
  }

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
}
