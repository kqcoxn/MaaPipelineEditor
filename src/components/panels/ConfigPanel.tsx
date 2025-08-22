import style from "../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Switch, Input } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import { useConfigStore } from "../../stores/configStore";
import { useFileStore } from "../../stores/fileStore";
import { configMarkPrefix, uniqueMark } from "../../core/parser";

const TipElem = memo(({ content }: { content: string }) => (
  <div style={{ maxWidth: 260 }}>{content}</div>
));

function ConfigPanel() {
  // store
  const isShowConfigPanel = useConfigStore(
    (state) => state.status.isShowConfigPanel
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const isExportConfig = useConfigStore(
    (state) => state.configs.isExportConfig
  );
  const setConfig = useConfigStore((state) => state.setConfig);
  const fileConfig = useFileStore((state) => state.currentFile.config);
  const setFileConfig = useFileStore((state) => state.setFileConfig);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": isShowConfigPanel,
      }),
    [isShowConfigPanel]
  );
  const globalClass = useMemo(() => classNames(style.item, style.global), []);
  const switchStyle = useMemo(() => ({ maxWidth: 60 }), []);

  // 渲染
  return (
    <div className={panelClass}>
      <div className={classNames("header", style.header)}>
        <div className="title">设置</div>
        <div className={style.right}>
          <IconFont
            className="icon-interactive"
            name="icon-dituweizhixinxi_chahao"
            size={20}
            onClick={() => setStatus("isShowConfigPanel", false)}
          />
        </div>
      </div>
      <div className={style.list}>
        <div className={style.divider}>————— Pipeline 配置 —————</div>
        <div className={style.item}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"节点前缀"}
              content={
                <TipElem
                  content={
                    "在所有节点前添加一个前缀，并使用 _ 与节点名连接，防止跨文件节点名重复"
                  }
                />
              }
            >
              <span>节点前缀</span>
            </Popover>
          </div>
          <Input
            className={style.value}
            style={{ maxWidth: 160 }}
            value={fileConfig.prefix}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFileConfig("prefix", e.target.value)
            }
          />
        </div>
        <div className={style.divider}>—————— 全局配置 ——————</div>
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"实时编译"}
              content={
                <TipElem
                  content={
                    "若节点或边发生变化，或选中的节点与边发生变化，则在防抖后实时编译并渲染在右侧JSON预览面板。（此功能对电脑性能要求较高，否则会造成轻微卡顿）"
                  }
                />
              }
            >
              <span>实时编译</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={isRealTimePreview}
            onChange={(value: boolean) => setConfig("isRealTimePreview", value)}
          />
        </div>
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"导出时附带配置"}
              content={
                <TipElem
                  content={`将Pipeline配置保存至"${configMarkPrefix}"，将节点配置保存至"${uniqueMark}"，若不开启则在再次导入时会丢失位置、前缀等信息`}
                />
              }
            >
              <span>导出时附带配置</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="是"
            unCheckedChildren="否"
            value={isExportConfig}
            onChange={(value: boolean) => setConfig("isExportConfig", value)}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ConfigPanel);
