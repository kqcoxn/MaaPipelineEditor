import type { CSSProperties, ReactNode } from "react";

export type IslandTone = "danger" | "gold";

export const ISLAND_EXIT_MS = 480;

export interface IslandSummary {
  title: string;
  subtitle: string;
  owner?: string;
}

export interface IslandAction {
  key: string;
  node: ReactNode;
}

export interface IslandRenderState {
  expanded: boolean;
  visualExpanded: boolean;
  detailsMounted: boolean;
  hovered: boolean;
  focused: boolean;
  exiting: boolean;
}

export interface IslandController extends IslandRenderState {
  hidden: boolean;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  dismiss: () => void;
}

export interface IslandAutoHide {
  enabled: boolean;
  durationMs: number;
  pauseWhenExpanded?: boolean;
}

/**灵动胶囊对外契约：壳层管进出场与展开，业务只填槽位。 */
export interface IslandProps {
  /**身份变化时重置展开/离场；同身份内容更新则保持当前形态 */
  islandKey?: string;
  tone?: IslandTone;
  className?: string;
  style?: CSSProperties;
  data?: Record<string, string | number | boolean | undefined>;
  indicator: ReactNode;
  summary: IslandSummary;
  onOpen: () => void;
  openLabel: string;
  openTitle?: string;
  /**主按钮右侧动作，可按当前控制器动态生成 */
  actions?: IslandAction[] | ((controller: IslandController) => IslandAction[]);
  expandable?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  details?: ReactNode | ((state: IslandRenderState) => ReactNode);
  extra?: ReactNode | ((controller: IslandController) => ReactNode);
  autoHide?: IslandAutoHide;
  onHidden?: () => void;
}
