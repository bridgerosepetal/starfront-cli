# Starfront CLI

CLI tooling for Starfront projects.

## Development

```sh
npm install
npm run build
npm test
```

## Local install check

```sh
npm pack --dry-run
npm install -g .
starfront --help
```

## MCP server

Start the Starfront MCP server for a specific project:

```sh
starfront mcp --project /path/to/project
```

The package also exposes a direct stdio bin:

```sh
starfront-mcp --project /path/to/project
```

MCP clients can switch the active project later with the `project_set_root` tool.

The MCP exposes structured UI component tools and low-level CLI replay tools:

- `command_reference` returns the shared CLI/MCP vocabulary.
- `ui_component_create`, `ui_component_update`, `ui_component_read`, `ui_component_validate`, `ui_component_list`, and `ui_component_delete` are the normal tools for UI component work.
- Prefer dedicated edit tools over `ui_component_update`: `ui_component_prop_create`, `ui_component_root_append`, `ui_component_bem_block_style_declare`, `ui_component_bem_element_style_declare`, `ui_component_bem_modifier_classlist_add`, `ui_component_bem_modifier_style_declare`, `ui_component_root_classlist_add`, and `ui_component_root_delete`.
- Creating a `variant` or `color` prop automatically adds the matching root BEM modifier expression to `class:list`.
- BEM elements are child parts such as `button__text`; BEM variants/colors/states should usually be root modifiers such as `button_variant-contained`.
- Variant value styles are nested SCSS. Use modifier `variant` with value `primary`, not modifier `variant-primary`; Starfront renders `&_variant { &-primary { ... } }`.
- `command_run` is a debug/replay escape hatch for exact CLI commands such as `starfront ui component create button button`.
- `command_history` returns timestamped CLI-equivalent commands for the current MCP session.

Every MCP command is also appended as JSONL to `.starfront/mcp.log` in the active project.

The command vocabulary is defined once in `starfrontCommandRegistry`. The CLI, MCP `command_run`, MCP
`command_reference`, and library `runStarfrontCommand` all use that registry.

## Library command vocabulary

Code can use the same command vocabulary without spawning the CLI:

```ts
import { runStarfrontCommand } from '@bridgerosepetal/starfront-cli'

await runStarfrontCommand({
  cwd: '/path/to/project',
  command: 'starfront ui component create button button',
})
```
