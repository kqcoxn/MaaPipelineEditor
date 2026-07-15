# Ant Design CLI

Use this reference when the task involves Ant Design component APIs, demos, docs, migration, project analysis, or debugging and the local `@ant-design/cli` can answer it offline.

## Rules
- Check install first: `which antd || npm install -g @ant-design/cli`
- If any command prints an update notice, run `npm install -g @ant-design/cli` before continuing.
- Always use `--format json`.
- Match the project version with `--version <x.y.z>` when needed.
- Query before writing antd code. Do not guess props from memory.
- After changing antd code, run `antd lint` on the changed path.

## Core workflows

### Writing component code
1. `antd info Button --format json`
2. `antd demo Button basic --format json`
3. Optionally inspect styling hooks:
   - `antd semantic Button --format json`
   - `antd token Button --format json`

### Full docs
- `antd doc Table --format json`
- `antd doc Table --lang zh --format json`

### Debugging
1. `antd doctor --format json`
2. `antd info Select --version 5.12.0 --format json`
3. `antd lint ./src/components/MyForm.tsx --format json`

### Migration
1. `antd migrate 4 5 --format json`
2. `antd migrate 4 5 --component Select --format json`
3. `antd changelog 4.24.0 5.0.0 --format json`
4. `antd changelog 4.24.0 5.0.0 Select --format json`

### Project analysis
- `antd usage ./src --format json`
- `antd usage ./src --filter Form --format json`
- `antd lint ./src --format json`
- `antd lint ./src --only deprecated --format json`
- `antd lint ./src --only a11y --format json`
- `antd lint ./src --only performance --format json`

### Changelog and versions
- `antd changelog 5.22.0 --format json`
- `antd changelog 5.21.0..5.24.0 --format json`

### Component discovery
- `antd list --format json`
- `antd list --version 5.0.0 --format json`

## Bug reporting

### antd component bugs
Preview first, then ask the user before submitting.

```bash
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --format json
```

Submit only after confirmation:

```bash
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --submit
```

### CLI bugs
Prepare a report whenever an `antd` command crashes, returns incorrect data, ignores flags, or is inconsistent with other commands.

```bash
antd bug-cli --title "antd info Button returns wrong props for v5.12.0" \
  --description "When querying Button props for version 5.12.0, the output includes props that don't exist in that version" \
  --steps "1. Run: antd info Button --version 5.12.0 --format json" \
  --expected "Props matching antd 5.12.0 Button API" \
  --actual "Props include 'classNames' which was added in 5.16.0" \
  --format json
```

Submit only after user confirmation:

```bash
antd bug-cli --title "antd info Button returns wrong props for v5.12.0" \
  --description "When querying Button props for version 5.12.0, the output includes props that don't exist in that version" \
  --steps "1. Run: antd info Button --version 5.12.0 --format json" \
  --expected "Props matching antd 5.12.0 Button API" \
  --actual "Props include 'classNames' which was added in 5.16.0" \
  --submit
```

## MCP mode
If the environment supports MCP, the CLI can run as:

```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp", "--version", "5.20.0"]
    }
  }
}
```

This exposes structured Ant Design knowledge tools through MCP without network access.
