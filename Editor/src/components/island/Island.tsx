import { Fragment, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DownOutlined } from "@ant-design/icons";

import { useIslandHost } from "./useIslandHost";
import { useIslandLifecycle } from "./useIslandLifecycle";
import type { IslandController, IslandProps, IslandRenderState } from "./types";
import metadataTag from "@/styles/MetadataTag.module.less";
import island from "@/styles/island/Island.module.less";

function resolveSlot<T, A>(value: T | ((arg: A) => T) | undefined, arg: A): T | undefined {
  if (value === undefined) return undefined;
  return typeof value === "function" ? (value as (arg: A) => T)(arg) : value;
}

function toDataAttributes(
  data?: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key.startsWith("data-") ? key : `data-${key}`,
      value,
    ]),
  );
}

export function IslandDetails({ children }: { children: ReactNode }) {
  return <div className={island.expandedContent}>{children}</div>;
}

/**画布顶部灵动胶囊。进场/离场、悬停暂停收起、可选展开由壳层负责，业务只填内容槽。 */
export function Island({
  islandKey,
  tone,
  className,
  style,
  data,
  indicator,
  summary,
  onOpen,
  openLabel,
  openTitle,
  actions,
  expandable,
  expandLabel = "展开详情",
  collapseLabel = "收起详情",
  details,
  extra,
  autoHide,
  onHidden,
}: IslandProps) {
  const host = useIslandHost();
  const detailsId = useId();
  const life = useIslandLifecycle(islandKey, host ? autoHide : undefined, onHidden);
  const renderState: IslandRenderState = {
    expanded: life.expanded,
    visualExpanded: life.visualExpanded,
    detailsMounted: life.detailsMounted,
    hovered: life.hovered,
    focused: life.focused,
    exiting: life.exiting,
  };
  const controller: IslandController = life;
  const visualOpen = life.expanded && life.visualExpanded;
  const actionNodes = resolveSlot(actions, controller) ?? [];
  const extraNode = resolveSlot(extra, controller);
  const detailsNode = resolveSlot(details, renderState);

  if (!host || life.hidden) return null;

  return createPortal(
    <div
      className={[island.shell, className].filter(Boolean).join(" ")}
      style={style}
      {...toDataAttributes(data)}
      data-exiting={life.exiting}
      data-expanded={visualOpen}
      data-tone={tone}
      data-hovered={life.hovered}
      onMouseEnter={() => life.setHovered(true)}
      onMouseLeave={() => life.setHovered(false)}
      onFocusCapture={() => life.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          life.setFocused(false);
        }
      }}
    >
      <div className={island.main}>
        <button
          className={island.details}
          type="button"
          onClick={onOpen}
          title={openTitle ?? openLabel}
          aria-label={openLabel}
        >
          <span className={island.indicator} aria-hidden="true">
            {indicator}
          </span>
          <span className={island.copy}>
            <span className={island.headline}>
              <span className={island.status} role="status">
                {summary.title}
              </span>
              {summary.owner !== undefined && (
                <span className={summary.ownerVariant === "tag" ? metadataTag.tag : island.owner} title={summary.owner}>
                  {summary.owner}
                </span>
              )}
            </span>
            <span className={island.node} title={summary.subtitle}>
              {summary.subtitle}
            </span>
          </span>
        </button>
        {actionNodes.map((action) => (
          <Fragment key={action.key}>{action.node}</Fragment>
        ))}
        {expandable && (
          <button
            className={island.expandButton}
            type="button"
            aria-expanded={life.expanded}
            aria-controls={detailsId}
            aria-label={life.expanded ? collapseLabel : expandLabel}
            onClick={life.toggleExpanded}
          >
            <DownOutlined className={island.chevron} />
          </button>
        )}
      </div>
      {expandable && (
        <div
          className={island.expansion}
          data-open={visualOpen}
          id={detailsId}
          inert={!life.expanded}
          aria-hidden={!life.expanded}
        >
          <div className={island.expansionInner}>
            {(life.expanded || life.detailsMounted) && detailsNode}
          </div>
        </div>
      )}
      {extraNode}
    </div>,
    host,
  );
}
