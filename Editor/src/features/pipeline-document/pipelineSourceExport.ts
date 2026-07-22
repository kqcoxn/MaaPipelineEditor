export type PipelineSourceExportTarget = "pipeline" | "config" | "both";
export type PipelineSourceExportFormat = "json" | "jsonc";

export interface PipelineSourceExportFile {
  name: string;
  text: string;
  format: PipelineSourceExportFormat;
}

export function createPipelineSourceExports(options: {
  baseName: string;
  format: PipelineSourceExportFormat;
  target: PipelineSourceExportTarget;
  pipelineText: string;
  configText?: string;
}): PipelineSourceExportFile[] {
  const files: PipelineSourceExportFile[] = [];
  if (options.target !== "config") {
    files.push({
      name: `${options.baseName}.${options.format}`,
      text: options.pipelineText,
      format: options.format,
    });
  }
  if (options.configText !== undefined && options.target !== "pipeline") {
    files.push({
      name: `${options.baseName}.mpe.json`,
      text: options.configText,
      format: "json",
    });
  }
  return files;
}
