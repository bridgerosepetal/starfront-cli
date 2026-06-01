const componentLocks = new Map<string, Promise<unknown>>()

function lockKey(componentName: string, cwd?: string): string {
  return `${cwd ?? process.cwd()}::${componentName}`
}

export async function withComponentLock<T>(
  componentName: string,
  cwd: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const key = lockKey(componentName, cwd)
  const previous = componentLocks.get(key) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>(resolve => {
    release = resolve
  })
  const tail = previous.catch(() => undefined).then(() => current)

  componentLocks.set(key, tail)

  await previous.catch(() => undefined)

  try {
    return await run()
  } finally {
    release()

    if (componentLocks.get(key) === tail) {
      componentLocks.delete(key)
    }
  }
}
