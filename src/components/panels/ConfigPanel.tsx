import style from "../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Switch } from "antd";
import classNames from "classnames";
import IconFont from "../iconfonts";

import { useConfigStore } from "../../stores/configStore";

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
  const setConfig = useConfigStore((state) => state.setConfig);

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

  // 渲染
  return (
    <div className={panelClass}>
      <div className={classNames("header", style.header)}>
        <div className="title">设置</div>
        <IconFont
          className={classNames("close", style.close, "icon-interactive")}
          name="icon-dituweizhixinxi_chahao"
          size={20}
          onClick={() => setStatus("isShowConfigPanel", false)}
        />
      </div>
      <div className={style.list}>
        <div className={style.item}>
          <Popover
            placement="right"
            title={"实时编译"}
            content={
              <TipElem
                content={
                  "若节点或边发生变化，或选中的节点与边发生变化，则在防抖后实时编译并渲染在右侧JSON预览面板。（此功能对电脑性能要求较高，否则会造成轻微卡顿）"
                }
              />
            }
          >
            <div className={style.key}>实时编译</div>
          </Popover>
          <Switch
            className={style.value}
            style={{ maxWidth: 60 }}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={isRealTimePreview}
            onChange={(value: boolean) => setConfig("isRealTimePreview", value)}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ConfigPanel);
