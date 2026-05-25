import { spawnSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const tempProjects: string[] = []

export async function createTempProject(): Promise<string> {
  const projectRoot = path.join(os.tmpdir(), `starfront-cli-test-${crypto.randomUUID()}`)

  tempProjects.push(projectRoot)
  await mkdir(path.join(projectRoot, 'src', 'shared', 'ui'), {
    recursive: true,
  })

  return projectRoot
}

export async function cleanupTempProjects(): Promise<void> {
  await Promise.all(
    tempProjects.splice(0).map(projectRoot =>
      rm(projectRoot, {
        force: true,
        recursive: true,
      }),
    ),
  )
}

export function runStarfront(projectRoot: string, args: string[]): string {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', '-C', projectRoot, ...args], {
    cwd: path.resolve(import.meta.dirname, '..', '..'),
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`starfront ${args.join(' ')} failed\n${result.stderr}`)
  }

  return result.stdout
}
