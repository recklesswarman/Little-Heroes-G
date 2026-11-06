import path from 'node:path';

export function resolveDistFile(distDir, requestUrl) {
  let requestPath = String(requestUrl || '').split('?')[0];
  if (requestPath.includes('\\')) return null;
  if (requestPath === '/') requestPath = '/index.html';

  const root = path.resolve(distDir);
  const filePath = path.resolve(root, `.${requestPath}`);
  const relativePath = path.relative(root, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) return null;
  return filePath;
}
