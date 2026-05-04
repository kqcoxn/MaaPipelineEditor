import { Alert, Button } from "antd";
import type { AlertProps } from "antd";
import { useWikiStore } from "../../../stores/wikiStore";
import type { WikiTarget } from "../../../wiki/types";
import style from "./WikiContextHint.module.less";

interface WikiContextHintAction {
  label: string;
  target: WikiTarget;
}

interface WikiContextHintProps {
  title: string;
  summary: string;
  actions: WikiContextHintAction[];
  type?: AlertProps["type"];
  className?: string;
  closable?: boolean;
  onClose?: () => void;
}

export function WikiContextHint({
  title,
  summary,
  actions,
  type = "info",
  className,
  closable = false,
  onClose,
}: WikiContextHintProps) {
  const openWiki = useWikiStore((state) => state.openWiki);

  const description = (
    <div className={style.description}>
      <p className={style.summary}>{summary}</p>
      <div className={style.actions}>
        {actions.map((action) => (
          <Button
            key={`${action.target.entryId}/${action.target.moduleId ?? ""}/${action.label}`}
            type="link"
            size="small"
            onClick={() => openWiki(action.target)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <Alert
      className={[style.hint, className].filter(Boolean).join(" ")}
      type={type}
      showIcon
      message={title}
      description={description}
      closable={closable}
      onClose={onClose}
    />
  );
}
