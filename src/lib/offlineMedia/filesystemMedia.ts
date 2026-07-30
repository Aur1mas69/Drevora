/**
 * Compatibility re-export.
 * Prefer importing from `@/lib/offlineMedia/offlineMediaStorage`
 * (Vite mode-aware: IndexedDB on web, Filesystem on native).
 */
export {
  OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
  OfflineMediaStorageError,
  buildOfflineCheckMediaDir,
  buildOfflinePhotoPath,
  buildOfflineSignaturePath,
  deleteOfflineMediaDirectory,
  deleteOfflineMediaFile,
  ensureOfflineMediaDirectory,
  listOfflineMediaDirectories,
  readOfflineMediaAsFile,
  writeOfflineMediaFile,
  writeOfflineMediaFromFile,
  type OfflineMediaWriteResult,
} from '@/lib/offlineMedia/offlineMediaStorage'
