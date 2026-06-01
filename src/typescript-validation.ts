import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { splitAstro } from './astro/file.ts'

type TypeScript = typeof import('typescript')

const require = createRequire(import.meta.url)
let tsModule: TypeScript | undefined

function getTypescript(): TypeScript {
  tsModule ??= require('typescript') as TypeScript
  return tsModule
}

function compilerOptions(projectRoot: string): import('typescript').CompilerOptions {
  const ts = getTypescript()
  const configPath = ts.findConfigFile(projectRoot, existsSync)

  if (!configPath) {
    return {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.Latest,
    }
  }

  const config = ts.readConfigFile(configPath, ts.sys.readFile)

  if (config.error) {
    return {
      noEmit: true,
      skipLibCheck: true,
    }
  }

  return {
    ...ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options,
    noEmit: true,
    skipLibCheck: true,
  }
}

function frontmatterStartLine(astroCode: string): number {
  return astroCode.startsWith('---\n') || astroCode.startsWith('---\r\n') ? 2 : 1
}

function isIgnoredDiagnostic(diagnostic: import('typescript').Diagnostic): boolean {
  // Component validation often runs in an isolated tree, before the app's aliases
  // and .astro module declarations are available. Avoid turning that into noise.
  return diagnostic.code === 2307
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function validateAstroTypeScript(
  astroCode: string,
  filePath: string,
  projectRoot: string,
  componentExportName: string,
): string[] {
  const ts = getTypescript()
  const frontmatter = splitAstro(astroCode).frontmatter.replace(
    new RegExp(`^\\s*export\\s+\\{\\s*${escapeRegExp(componentExportName)}\\s*\\}\\s*$`, 'm'),
    '',
  )

  if (!frontmatter.trim()) {
    return []
  }

  const virtualFile = filePath.replace(/\.astro$/i, '.astro.ts')
  const ambientFile = path.join(projectRoot, '__starfront_astro_globals.d.ts')
  const options = compilerOptions(projectRoot)
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path.resolve(fileName) === path.resolve(virtualFile)) {
      return ts.createSourceFile(fileName, frontmatter, languageVersion, true, ts.ScriptKind.TS)
    }

    if (path.resolve(fileName) === path.resolve(ambientFile)) {
      return ts.createSourceFile(
        fileName,
        [
          'declare const Astro: { props: Record<string, unknown> }',
          'declare module "astro/types" {',
          '  export type HTMLAttributes<T extends string = string> = Record<string, unknown> & { class?: string }',
          '}',
        ].join('\n'),
        languageVersion,
        true,
        ts.ScriptKind.TS,
      )
    }

    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
  }

  const program = ts.createProgram([ambientFile, virtualFile], options, host)
  const sourceFile = program.getSourceFile(virtualFile)
  const startLine = frontmatterStartLine(astroCode)

  return ts
    .getPreEmitDiagnostics(program, sourceFile)
    .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error && !isIgnoredDiagnostic(diagnostic))
    .map(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
      const position =
        sourceFile && typeof diagnostic.start === 'number'
          ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
          : undefined
      const location = position ? `${path.basename(filePath)}:${position.line + startLine}:${position.character + 1}` : path.basename(filePath)

      return `TypeScript error in ${location} - TS${diagnostic.code}: ${message}`
    })
}
