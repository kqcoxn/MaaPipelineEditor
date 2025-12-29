import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Switch, InputNumber, Button, message } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import { localServer } from "../../../services";
import TipElem from "./TipElem";

interface LocalServiceSectionProps {
  onOpenBackendConfig: () => void;
}

const LocalServiceSection = memo(
  ({ onOpenBackendConfig }: LocalServiceSectionProps) => {
    const wsPort = useConfigStore((state) => state.configs.wsPort);
    const wsAutoConnect = useConfigStore(
      (state) => state.configs.wsAutoConnect
    );
    const fileAutoReload = useConfigStore(
      (state) => state.configs.fileAutoReload
    );
    const setConfig = useConfigStore((state) => state.setConfig);

    const globalClass = useMemo(() => classNames(style.item, style.global), []);
    const switchStyle = useMemo(() => ({ maxWidth: 60 }), []);

    return (
      <>
        <div className={style.divider}>—————— 本地通信 ——————</div>
        {/* 本地服务配置 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"本地服务配置"}
              content={
                <TipElem
                  content={
                    "查看和修改后端服务的配置，包括服务器、文件、日志、MaaFramework 等设置"
                  }
                />
              }
            >
              <span>本地服务配置</span>
            </Popover>
          </div>
          <div className={style.value}>
            <Button
              size="small"
              onClick={() => {
                if (!localServer.isConnected()) {
                  message.warning("请先连接本地服务");
                  return;
                }
                onOpenBackendConfig();
              }}
            >
              打开配置
            </Button>
          </div>
        </div>
        {/* WebSocket 端口 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"WebSocket 端口"}
              content={
                <TipElem content={"本地服务端口，修改端口后需要重新连接"} />
              }
            >
              <span>连接端口</span>
            </Popover>
          </div>
          <InputNumber
            className={style.value}
            style={{ maxWidth: 100 }}
            min={1024}
            max={65535}
            value={wsPort}
            onChange={(value: number | null) => {
              if (value !== null) setConfig("wsPort", value);
            }}
          />
        </div>
        {/* 自动连接 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"自动连接"}
              content={
                <TipElem
                  content={"开启后，进入页面时会自动尝试连接本地通信服务"}
                />
              }
            >
              <span>自动连接</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={wsAutoConnect}
            onChange={(value: boolean) => setConfig("wsAutoConnect", value)}
          />
        </div>
        {/* 自动重载 */}
        <div className={globalClass}>
          <div className={style.key}>
            <Popover
              placement="bottomLeft"
              title={"自动重载变更文件"}
              content={
                <TipElem
                  content={
                    "开启后，当文件被外部修改时会自动重新加载文件内容，无需手动确认"
                  }
                />
              }
            >
              <span>自动重载变更文件</span>
            </Popover>
          </div>
          <Switch
            className={style.value}
            style={switchStyle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            value={fileAutoReload}
            onChange={(value: boolean) => setConfig("fileAutoReload", value)}
          />
        </div>
      </>
    );
  }
);

export default LocalServiceSection;
