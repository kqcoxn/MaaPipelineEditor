import { type CSSProperties, type ReactNode } from "react";
import { Empty, Spin } from "antd";

interface ListProps<T = any> {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => ReactNode;
  size?: "default" | "small" | "large";
  bordered?: boolean;
  split?: boolean;
  loading?: boolean;
  locale?: { emptyText?: ReactNode };
  pagination?: false | { pageSize?: number };
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

interface ListItemProps {
  className?: string;
  style?: CSSProperties;
  actions?: ReactNode[];
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  children?: ReactNode;
}

interface ListItemMetaProps {
  title?: ReactNode;
  description?: ReactNode;
  avatar?: ReactNode;
}

function ListItemMeta({ title, description, avatar }: ListItemMetaProps) {
  return (
    <div style={metaStyle}>
      {avatar && <div style={metaAvatarStyle}>{avatar}</div>}
      <div style={metaContentStyle}>
        {title && <div style={metaTitleStyle}>{title}</div>}
        {description && <div style={metaDescStyle}>{description}</div>}
      </div>
    </div>
  );
}

function ListItem({
  className,
  style,
  actions,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: ListItemProps) {
  return (
    <div
      className={className}
      style={{ ...itemStyle, ...style }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={itemContentStyle}>{children}</div>
      {actions && actions.length > 0 && (
        <ul style={actionsStyle}>
          {actions.map((action, i) => (
            <li key={i} style={actionItemStyle}>
              {action}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function List<T = any>({
  dataSource,
  renderItem,
  size = "default",
  bordered,
  split = true,
  loading,
  locale,
  className,
  style,
  children,
}: ListProps<T>) {
  const items = dataSource ?? [];
  const isEmpty = items.length === 0;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <Spin />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...containerStyle,
        ...(bordered ? borderedStyle : undefined),
        ...(size === "small" ? smallPaddingStyle : undefined),
        ...style,
      }}
    >
      {isEmpty && locale?.emptyText ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={locale.emptyText}
        />
      ) : (
        <>
          {renderItem
            ? items.map((item, index) => (
                <div
                  key={index}
                  style={split && index < items.length - 1 ? splitBorderStyle : undefined}
                >
                  {renderItem(item, index)}
                </div>
              ))
            : children}
        </>
      )}
    </div>
  );
}

List.Item = ListItem;
(List.Item as any).Meta = ListItemMeta;

// --- styles ---
const containerStyle: CSSProperties = {
  position: "relative",
};

const borderedStyle: CSSProperties = {
  border: "1px solid #d9d9d9",
  borderRadius: 8,
};

const smallPaddingStyle: CSSProperties = {
  padding: "0 8px",
};

const splitBorderStyle: CSSProperties = {
  borderBottom: "1px solid #f0f0f0",
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
};

const itemContentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  margin: 0,
  padding: 0,
  listStyle: "none",
  marginLeft: 16,
  flexShrink: 0,
};

const actionItemStyle: CSSProperties = {};

const metaStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

const metaAvatarStyle: CSSProperties = {
  flexShrink: 0,
};

const metaContentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const metaTitleStyle: CSSProperties = {
  marginBottom: 4,
  fontSize: 14,
  fontWeight: 500,
};

const metaDescStyle: CSSProperties = {
  fontSize: 13,
};
