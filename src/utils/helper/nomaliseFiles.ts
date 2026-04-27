import { Express } from 'express';

function buildRelativePath(file: any): string {
  const normalized = file.path.replace(/\\/g, '/');
  const afterUploads = normalized.split('uploads')[1] ?? '';
  return afterUploads.startsWith('/') ? afterUploads : `/${afterUploads}`;
}

/**
 * Returns the public-facing relative URL(s) for uploaded files.
 */
export function getPublicUrl(
  file: any,
): string | string[] | null {
  if (!file) return null;
  if (Array.isArray(file)) return file.map(buildRelativePath);
  return buildRelativePath(file);
}
