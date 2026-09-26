import { useEffect, useState } from "react";

const versionKey = "mpe_last_version";

/** Record a version only when its release notes actually open. */
export function useUpdateLog(
  currentVersion: string,
  isEmbed: boolean,
  isDesktop: boolean,
) {
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [lastOpenedVersion, setLastOpenedVersion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isEmbed) return;
    const show = () => {
      setLastOpenedVersion(localStorage.getItem(versionKey));
      setUpdateLogOpen(true);
      localStorage.setItem(versionKey, currentVersion);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isDesktop || localStorage.getItem("mpe_newcomer_passed") === "true") {
      if (localStorage.getItem(versionKey) !== currentVersion) {
        timer = setTimeout(show, 500);
      }
    }
    const onPassed = () => {
      clearTimeout(timer);
      show();
    };
    if (!isDesktop) window.addEventListener("mpe:newcomer-passed", onPassed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mpe:newcomer-passed", onPassed);
    };
  }, [currentVersion, isEmbed, isDesktop]);

  return { updateLogOpen, setUpdateLogOpen, lastOpenedVersion };
}
