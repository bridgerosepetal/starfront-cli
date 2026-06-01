import { createRequire } from 'node:module'

export type ComponentProp = {
  name: string
  type: string
  optional: boolean
  default?: string
}

export type PropSignatureMatch = {
  start: number
  end: number
  ambiguous?: boolean
}

type TypeScript = typeof import('typescript')

const require = createRequire(import.meta.url)
let tsModule: TypeScript | undefined

function getTypescript(): TypeScript {
  tsModule ??= require('typescript') as TypeScript
  return tsModule
}

function createSourceFile(frontmatter: string): import('typescript').SourceFile {
  const ts = getTypescript()

  return ts.createSourceFile('component.ts', frontmatter, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function parseDestructuredDefaults(frontmatter: string): Map<string, string> {
  const ts = getTypescript()
  const sourceFile = createSourceFile(frontmatter)
  const defaults = new Map<string, string>()

  function visit(node: import('typescript').Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer?.getText(sourceFile).includes('Astro.props')
    ) {
      for (const element of node.name.elements) {
        const propertyName = (element.propertyName ?? element.name).getText(sourceFile)
        const initializer = element.initializer?.getText(sourceFile)

        if (initializer) {
          defaults.set(propertyName, initializer)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return defaults
}

function collectTypeLiteralNodes(
  node: import('typescript').Node,
  literals: import('typescript').TypeLiteralNode[] = [],
): import('typescript').TypeLiteralNode[] {
  const ts = getTypescript()

  if (ts.isTypeLiteralNode(node)) {
    literals.push(node)
  }

  ts.forEachChild(node, child => {
    collectTypeLiteralNodes(child, literals)
  })

  return literals
}

function collectPropsInterfaceNames(frontmatter: string): Set<string> {
  const ts = getTypescript()
  const sourceFile = createSourceFile(frontmatter)
  const names = new Set<string>()
  const propsAlias = sourceFile.statements.find(
    statement => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Props',
  )

  if (!propsAlias || !ts.isTypeAliasDeclaration(propsAlias)) {
    return names
  }

  function visit(node: import('typescript').Node): void {
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      names.add(node.typeName.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(propsAlias.type)
  names.delete('HTMLAttributes')
  names.delete('Props')
  return names
}

function collectPropSignatures(frontmatter: string, propName: string, group?: string): PropSignatureMatch[] {
  const ts = getTypescript()
  const sourceFile = createSourceFile(frontmatter)
  const matches: PropSignatureMatch[] = []

  function maybeAdd(signature: import('typescript').PropertySignature): void {
    if (signature.name.getText(sourceFile) === propName) {
      matches.push({ start: signature.getStart(sourceFile), end: signature.getEnd() })
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      if (group && statement.name.text !== group) {
        continue
      }

      for (const member of statement.members.filter(ts.isPropertySignature)) {
        maybeAdd(member)
      }
    }

    if (!group && ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Props') {
      for (const typeLiteral of collectTypeLiteralNodes(statement.type)) {
        for (const member of typeLiteral.members.filter(ts.isPropertySignature)) {
          maybeAdd(member)
        }
      }
    }
  }

  return matches
}

function propFromSignature(
  signature: import('typescript').PropertySignature,
  defaults: Map<string, string>,
  sourceFile: import('typescript').SourceFile,
): ComponentProp {
  const name = signature.name.getText(sourceFile)
  const defaultValue = defaults.get(name)

  return {
    name,
    type: signature.type?.getText(sourceFile) ?? 'unknown',
    optional: Boolean(signature.questionToken),
    ...(defaultValue ? { default: defaultValue } : {}),
  }
}

export function parseProps(frontmatter: string): ComponentProp[] {
  const ts = getTypescript()
  const sourceFile = createSourceFile(frontmatter)
  const defaults = parseDestructuredDefaults(frontmatter)
  const propsInterfaceNames = collectPropsInterfaceNames(frontmatter)
  const props: ComponentProp[] = []

  for (const statement of sourceFile.statements) {
    if (
      ts.isInterfaceDeclaration(statement) &&
      (statement.name.text === 'Props' || propsInterfaceNames.has(statement.name.text))
    ) {
      props.push(
        ...statement.members
          .filter(ts.isPropertySignature)
          .map(signature => propFromSignature(signature, defaults, sourceFile)),
      )
    }

    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Props') {
      props.push(
        ...collectTypeLiteralNodes(statement.type)
          .flatMap(typeLiteral => [...typeLiteral.members])
          .filter(ts.isPropertySignature)
          .map(signature => propFromSignature(signature, defaults, sourceFile)),
      )
    }
  }

  return props
}

export function findPropSignature(
  frontmatter: string,
  propName: string,
  group?: string,
): PropSignatureMatch | undefined {
  const matches = collectPropSignatures(frontmatter, propName, group)

  if (matches.length > 1) {
    return { start: matches[0].start, end: matches[0].end, ambiguous: true }
  }

  return matches[0]
}
