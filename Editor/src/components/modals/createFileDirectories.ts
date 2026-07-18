export function normalizePipelineDirectories(directories: string[]): string[] {
  return [...new Set(directories)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function getInitialPipelineDirectory(
  directories: string[],
  currentFilePath?: string,
): string {
  if (currentFilePath) {
    const separatorIndex = Math.max(
      currentFilePath.lastIndexOf("/"),
      currentFilePath.lastIndexOf("\\"),
    );
    const currentDirectory =
      separatorIndex > 0 ? currentFilePath.substring(0, separatorIndex) : "";
    if (directories.includes(currentDirectory)) return currentDirectory;
  }
  return directories[0] ?? "";
}

export function formatPipelineDirectory(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}
