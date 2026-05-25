import path from 'node:path'

export function normalizeProjectRoot(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd())
}

export function getUiRoot(cwd?: string): string {
  const projectRoot = normalizeProjectRoot(cwd)
  return path.join(projectRoot, 'src', 'shared', 'ui')
}

export function relative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, '/')
}
