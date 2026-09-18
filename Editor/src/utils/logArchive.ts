import { desktopContext, desktopInvoke } from "@/features/desktop/host";

/** null means cancelled; browser downloads cannot report a filesystem path. */
export async function saveLogArchive(
  content: string,
  name: string,
): Promise<{ path?: string } | null> {
  if (desktopContext) {
    const path = await desktopInvoke<string | null>("desktop_save_archive", {
      name,
      content,
    });
    return path === null ? null : { path };
  }
  const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/zip" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {};
}
