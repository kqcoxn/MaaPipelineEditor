import { FilterOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip, type MenuProps } from "antd";
import { useMemo, useState } from "react";

import type { ResourceBundle } from "../../stores/resourceStore";
import style from "../../styles/layout/ProjectSidebar.module.less";
import type { ProjectTreeFilter } from "./projectTree";

const ALL_FILES_KEY = "all-files";
const INTERFACE_FILES_KEY = "interface-files";
const RESOURCE_KEY_PREFIX = "resource:";

interface ProjectTreeFilterProps {
  resourceBundles: ResourceBundle[];
  hasInterfaceFiles: boolean;
  value: ProjectTreeFilter;
  onChange: (value: ProjectTreeFilter) => void;
}

function resourceKey(path: string): string {
  return `${RESOURCE_KEY_PREFIX}${path}`;
}

export function ProjectTreeFilterButton({
  resourceBundles,
  hasInterfaceFiles,
  value,
  onChange,
}: ProjectTreeFilterProps) {
  const [open, setOpen] = useState(false);
  const resourceOptions = useMemo(
    () =>
      Array.from(
        new Map(
          resourceBundles
            .filter((bundle) => bundle.rel_path)
            .map((bundle) => [bundle.rel_path, bundle]),
        ).values(),
      ),
    [resourceBundles],
  );
  const activeCount =
    value.resourcePaths.length + Number(value.includeInterfaceFiles);
  const selectedKeys = activeCount
    ? [
        ...value.resourcePaths.map(resourceKey),
        ...(value.includeInterfaceFiles ? [INTERFACE_FILES_KEY] : []),
      ]
    : [ALL_FILES_KEY];

  const items = useMemo<MenuProps["items"]>(
    () => [
      { key: ALL_FILES_KEY, label: "全部文件" },
      { type: "divider" },
      {
        type: "group",
        label: "资源目录",
        children: resourceOptions.map((bundle) => ({
          key: resourceKey(bundle.rel_path),
          label: bundle.name || bundle.rel_path.split("/").at(-1),
          title: bundle.rel_path,
        })),
      },
      {
        type: "group",
        label: "项目文件",
        children: [
          {
            key: INTERFACE_FILES_KEY,
            label: "Interface / import 文件",
            disabled: !hasInterfaceFiles,
          },
        ],
      },
    ],
    [hasInterfaceFiles, resourceOptions],
  );

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    if (key === ALL_FILES_KEY) {
      onChange({ resourcePaths: [], includeInterfaceFiles: false });
      return;
    }
    if (key === INTERFACE_FILES_KEY) {
      onChange({
        ...value,
        includeInterfaceFiles: !value.includeInterfaceFiles,
      });
      return;
    }
    if (!key.startsWith(RESOURCE_KEY_PREFIX)) return;

    const path = key.slice(RESOURCE_KEY_PREFIX.length);
    const selected = value.resourcePaths.includes(path);
    onChange({
      ...value,
      resourcePaths: selected
        ? value.resourcePaths.filter((resourcePath) => resourcePath !== path)
        : [...value.resourcePaths, path],
    });
  };

  const tooltip = activeCount
    ? `筛选项目文件（已选择 ${activeCount} 项）`
    : "筛选项目文件";

  return (
    <Dropdown
      open={open}
      placement="bottomRight"
      trigger={["click"]}
      menu={{
        items,
        multiple: true,
        selectedKeys,
        onClick: handleClick,
      }}
      classNames={{ root: style.filterDropdown }}
      onOpenChange={(nextOpen, info) => {
        if (info.source === "trigger") setOpen(nextOpen);
      }}
    >
      <Tooltip title={tooltip} placement="bottom">
        <Button
          type="text"
          size="small"
          icon={<FilterOutlined />}
          className={activeCount ? style.filterButtonActive : undefined}
          aria-label={tooltip}
        />
      </Tooltip>
    </Dropdown>
  );
}
