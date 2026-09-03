export interface HarnessCommandDefinition {
  name: string;
  label: string;
  description: string;
}

export const HARNESS_COMMANDS: readonly HarnessCommandDefinition[] = [
  {
    name: "compact",
    label: "压缩上下文",
    description: "总结较早对话和工具结果，保留最近上下文",
  },
];

export interface ParsedHarnessCommand {
  command: HarnessCommandDefinition;
  instructions: string;
}

export function getHarnessCommandQuery(value: string): string | null {
  const trimmed = value.trimStart();
  if (!trimmed.startsWith("/") || /\s/.test(trimmed)) return null;
  return trimmed.slice(1);
}

export function searchHarnessCommands(
  query: string,
): HarnessCommandDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();
  return HARNESS_COMMANDS.map((command) => ({
    command,
    score: fuzzyScore(
      normalizedQuery,
      `${command.name} ${command.label} ${command.description}`,
    ),
  }))
    .filter((item) => item.score !== null)
    .sort((left, right) => left.score! - right.score!)
    .map((item) => item.command);
}

export function parseHarnessCommand(value: string): ParsedHarnessCommand | null {
  const match = /^\s*\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(value);
  if (!match) return null;
  const command = HARNESS_COMMANDS.find((item) => item.name === match[1]);
  return command
    ? { command, instructions: match[2]?.trim() ?? "" }
    : null;
}

function fuzzyScore(query: string, candidate: string): number | null {
  if (!query) return 0;
  const normalizedCandidate = candidate.toLowerCase();
  let queryIndex = 0;
  let score = 0;
  let previousIndex = -1;
  for (let index = 0; index < normalizedCandidate.length; index += 1) {
    if (normalizedCandidate[index] !== query[queryIndex]) continue;
    score += index === previousIndex + 1 ? 0 : index + 1;
    previousIndex = index;
    queryIndex += 1;
    if (queryIndex === query.length) return score;
  }
  return null;
}
