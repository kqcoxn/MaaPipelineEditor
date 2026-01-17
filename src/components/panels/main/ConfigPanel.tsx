import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo, useEffect, useState } from "react";
import classNames from "classnames";
import IconFont from "../../iconfonts";

import { useConfigStore } from "../../../stores/configStore";
import { localServer } from "../../../services";
import { BackendConfigModal } from "../../modals";
import FileConfigSection from "../config/FileConfigSection";
import PipelineConfigSection from "../config/PipelineConfigSection";
import PanelConfigSection from "../config/PanelConfigSection";
import LocalServiceSection from "../config/LocalServiceSection";
import AIConfigSection from "../config/AIConfigSection";
import ConfigManagementSection from "../config/ConfigManagementSection";
import SystemInfoPanel from "../tools/SystemInfoPanel";

function ConfigPanel() {
  // 后端配置模态框状态
  const [backendConfigOpen, setBackendConfigOpen] = useState(false);

  // store
  const showConfigPanel = useConfigStore(
    (state) => state.status.showConfigPanel
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const wsPort = useConfigStore((state) => state.configs.wsPort);

  // WebSocket端口配置同步
  useEffect(() => {
    localServer.setPort(wsPort);
  }, [wsPort]);

  // 样式
  const panelClass = useMemo(
    () =>
      classNames({
        "panel-base": true,
        [style.panel]: true,
        "panel-show": showConfigPanel,
      }),
    [showConfigPanel]
  );

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
            onClick={() => setStatus("showConfigPanel", false)}
          />
        </div>
      </div>
      <div className={style.list}>
        <FileConfigSection />
        <PipelineConfigSection />
        <PanelConfigSection />
        <LocalServiceSection
          onOpenBackendConfig={() => setBackendConfigOpen(true)}
        />
        <AIConfigSection />
        <ConfigManagementSection />
        <SystemInfoPanel />
      </div>
      {/* 后端配置模态框 */}
      <BackendConfigModal
        open={backendConfigOpen}
        onClose={() => setBackendConfigOpen(false)}
      />
    </div>
  );
}

export default memo(ConfigPanel);
