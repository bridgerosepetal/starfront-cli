import { createRequire } from 'node:module'

export type ComponentProp = {
  name: string
  type: string
  optional: boolean
  default?: string
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
  const props: ComponentProp[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === 'Props') {
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
