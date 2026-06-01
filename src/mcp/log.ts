import { existsSync } from 'node:fs'
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatCliCommand } from '../command-vocabulary.ts'
import { getUiRoot } from '../utils/project.ts'

export type McpCommandLogEntry = {
  id: number
  timestamp: string
  projectRoot: string
  tool: string
  command: string
  args: string[]
  status: 'ok' | 'error'
  durationMs: number
  error?: string
}

export type McpCommandLogger = {
  entries(): McpCommandLogEntry[]
  record<T>(input: {
    projectRoot: string
    tool: string
    args: string[]
    run: () => Promise<T>
    undoable?: boolean
  }): Promise<T>
  undo(projectRoot?: string): Promise<{ action: 'undo'; entry: McpCommandLogEntry }>
  redo(projectRoot?: string): Promise<{ action: 'redo'; entry: McpCommandLogEntry }>
}

type FileSnapshot = Map<string, Buffer>

type HistoryAction = {
  entry: McpCommandLogEntry
  before: FileSnapshot
  after: FileSnapshot
}

async function snapshotDirectory(root: string): Promise<FileSnapshot> {
  const snapshot: FileSnapshot = new Map()

  if (!existsSync(root)) {
    return snapshot
  }

  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const filePath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await visit(filePath)
        continue
      }

      if (entry.isFile()) {
        snapshot.set(path.relative(root, filePath), await readFile(filePath))
      }
    }
  }

  await visit(root)
  return snapshot
}

async function restoreDirectory(root: string, snapshot: FileSnapshot): Promise<void> {
  await rm(root, { recursive: true, force: true })

  for (const [relativePath, content] of snapshot) {
    const filePath = path.join(root, relativePath)

    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
}

function snapshotsEqual(left: FileSnapshot, right: FileSnapshot): boolean {
  if (left.size !== right.size) {
    return false
  }

  for (const [file, content] of left) {
    const other = right.get(file)

    if (!other || !content.equals(other)) {
      return false
    }
  }

  return true
}

function snapshotRoot(projectRoot: string, args: string[]): string {
  const [area, subject, action, componentName] = args

  if (area === 'ui' && subject === 'component' && ['create', 'update', 'delete'].includes(action ?? '') && componentName) {
    return path.join(getUiRoot(projectRoot), componentName)
  }

  return getUiRoot(projectRoot)
}

function isUndoableTool(tool: string): boolean {
  if (tool === 'command_run') {
    return true
  }

  if (!tool.startsWith('ui_component_')) {
    return false
  }

  return !['ui_component_list', 'ui_component_read', 'ui_component_validate'].includes(tool)
}

function findLastHistoryIndex(actions: HistoryAction[], projectRoot?: string): number {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (!projectRoot || actions[index]?.entry.projectRoot === projectRoot) {
      return index
    }
  }

  return -1
}

export function createMcpCommandLogger(): McpCommandLogger {
  const entries: McpCommandLogEntry[] = []
  const undoStack: HistoryAction[] = []
  const redoStack: HistoryAction[] = []
  let nextId = 1

  async function writeLog(projectRoot: string, entry: McpCommandLogEntry): Promise<void> {
    const logDir = path.join(projectRoot, '.starfront')
    const logPath = path.join(logDir, 'mcp.log')

    await mkdir(logDir, { recursive: true })
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
  }

  return {
    entries: () => [...entries],
    async record({ projectRoot, tool, args, run, undoable = isUndoableTool(tool) }) {
      const started = performance.now()
      const timestamp = new Date().toISOString()
      const command = formatCliCommand(args)
      const root = undoable ? snapshotRoot(projectRoot, args) : undefined
      const before = root ? await snapshotDirectory(root) : undefined

      try {
        const result = await run()
        const after = root ? await snapshotDirectory(root) : undefined
        const entry: McpCommandLogEntry = {
          id: nextId,
          timestamp,
          projectRoot,
          tool,
          command,
          args,
          status: 'ok',
          durationMs: Math.round(performance.now() - started),
        }

        nextId += 1
        entries.push(entry)
        if (before && after && !snapshotsEqual(before, after)) {
          undoStack.push({ entry, before, after })

          for (let index = redoStack.length - 1; index >= 0; index -= 1) {
            if (redoStack[index]?.entry.projectRoot === projectRoot) {
              redoStack.splice(index, 1)
            }
          }
        }
        console.error(`[starfront-mcp] ${entry.timestamp} ok ${entry.command}`)
        await writeLog(projectRoot, entry)
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (before) {
          await restoreDirectory(root ?? getUiRoot(projectRoot), before)
        }

        const entry: McpCommandLogEntry = {
          id: nextId,
          timestamp,
          projectRoot,
          tool,
          command,
          args,
          status: 'error',
          durationMs: Math.round(performance.now() - started),
          error: message,
        }

        nextId += 1
        entries.push(entry)
        console.error(`[starfront-mcp] ${entry.timestamp} error ${entry.command}: ${message}`)
        await writeLog(projectRoot, entry)
        throw error
      }
    },
    async undo(projectRoot?: string) {
      const index = findLastHistoryIndex(undoStack, projectRoot)
      const action = index === -1 ? undefined : undoStack.splice(index, 1)[0]

      if (!action) {
        throw new Error('No command to undo')
      }

      await restoreDirectory(snapshotRoot(action.entry.projectRoot, action.entry.args), action.before)
      redoStack.push(action)
      return { action: 'undo', entry: action.entry }
    },
    async redo(projectRoot?: string) {
      const index = findLastHistoryIndex(redoStack, projectRoot)
      const action = index === -1 ? undefined : redoStack.splice(index, 1)[0]

      if (!action) {
        throw new Error('No command to redo')
      }

      await restoreDirectory(snapshotRoot(action.entry.projectRoot, action.entry.args), action.after)
      undoStack.push(action)
      return { action: 'redo', entry: action.entry }
    },
  }
}
