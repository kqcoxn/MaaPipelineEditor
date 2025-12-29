import style from "../../../styles/ConfigPanel.module.less";

import { memo, useMemo } from "react";
import { Popover, Switch, InputNumber, Select } from "antd";
import classNames from "classnames";

import { useConfigStore } from "../../../stores/configStore";
import TipElem from "./TipElem";

const PanelConfigSection = memo(() => {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const historyLimit = useConfigStore((state) => state.configs.historyLimit);
  const isRealTimePreview = useConfigStore(
    (state) => state.configs.isRealTimePreview
  );
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint
  );
  const isAutoFocus = useConfigStore((state) => state.configs.isAutoFocus);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode
  );
  const setConfig = useConfigStore((state) => state.setConfig);

  const globalClass = useMemo(() => classNames(style.item, style.global), []);
  const switchStyle = useMemo(() => ({ maxWidth: 60 }), []);

  return (
    <>
      <div className={style.divider}>—————— 面板配置 ——————</div>
      {/* 节点风格 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"节点风格"}
            content="切换节点的显示风格：现代风格具有分组标题和图标，经典风格为原始平铺展示"
          >
            <span>节点风格</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 70 }}
          value={nodeStyle}
          onChange={(value) => setConfig("nodeStyle", value)}
          options={[
            { value: "modern", label: "现代风格" },
            { value: "classic", label: "经典风格" },
          ]}
        />
      </div>
      {/* 历史记录上限 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"历史记录上限"}
            content="设置撤销/重做功能的最大历史记录数量，设置过大可能占用较多内存并产生卡顿"
          >
            <span>历史记录上限</span>
          </Popover>
        </div>
        <InputNumber
          className={style.value}
          style={{ maxWidth: 80 }}
          min={10}
          max={10000}
          value={historyLimit}
          onChange={(value: number | null) => {
            if (value !== null) setConfig("historyLimit", value);
          }}
        />
      </div>
      {/* 实时编译 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"实时编译"}
            content={
              <TipElem
                content={
                  "若节点或边发生变化，或选中的节点与边发生变化，则在防抖后实时编译并渲染在右侧JSON预览面板。（此功能对电脑性能要求较高，否则会造成严重卡顿）"
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
      {/* 显示边标签 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"显示边标签"}
            content={
              <TipElem
                content={
                  "开启时边中心会显示连接次序，若影响观察可关闭此选项；显示时会稍微增加拖拽节点时性能损耗，若造成明显卡顿请关闭此选项。"
                }
              />
            }
          >
            <span>显示边标签</span>
          </Popover>
        </div>
        <Switch
          className={style.value}
          style={switchStyle}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
          value={showEdgeLabel}
          onChange={(value: boolean) => setConfig("showEdgeLabel", value)}
        />
      </div>
      {/* 边拖拽手柄 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"边拖拽手柄"}
            content={
              <TipElem
                content={
                  "开启时可以拖拽连接线中间的手柄来调整路径形状，该效果不会保存。双击手柄可重置单条连接线，排版工具中可一键重置所有连接线。"
                }
              />
            }
          >
            <span>边拖拽手柄</span>
          </Popover>
        </div>
        <Switch
          className={style.value}
          style={switchStyle}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
          value={showEdgeControlPoint}
          onChange={(value: boolean) =>
            setConfig("showEdgeControlPoint", value)
          }
        />
      </div>
      {/* 自动聚焦 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"自动聚焦"}
            content={
              <TipElem content={"开启时若出现新节点则自动移动视口以聚焦"} />
            }
          >
            <span>自动聚焦</span>
          </Popover>
        </div>
        <Switch
          className={style.value}
          style={switchStyle}
          checkedChildren="启用"
          unCheckedChildren="关闭"
          value={isAutoFocus}
          onChange={(value: boolean) => setConfig("isAutoFocus", value)}
        />
      </div>
      {/* 非聚焦节点不透明度 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title={"非聚焦节点不透明度"}
            content={
              <TipElem
                content={
                  "选中节点或边时，非相关元素的透明度。设置为1时关闭此功能，小于1时只完全显示与选中元素直接关联的节点和边"
                }
              />
            }
          >
            <span>非聚焦节点不透明度</span>
          </Popover>
        </div>
        <InputNumber
          className={style.value}
          style={{ maxWidth: 80 }}
          min={0}
          max={1}
          step={0.1}
          value={focusOpacity}
          onChange={(value: number | null) => {
            if (value !== null) setConfig("focusOpacity", value);
          }}
        />
      </div>
      {/* 配置处理方案 */}
      <div className={globalClass}>
        <div className={style.key}>
          <Popover
            placement="bottomLeft"
            title="配置处理方案"
            content={
              <TipElem
                content={
                  "集成导出：配置嵌入 Pipeline 文件，适合单文件分享\n分离导出：配置存储至独立 .mpe.json 文件，便于版本管理\n不导出：不保存任何配置，导入时触发自动布局"
                }
              />
            }
          >
            <span>配置处理方案</span>
          </Popover>
        </div>
        <Select
          className={style.value}
          style={{ width: 90 }}
          value={configHandlingMode}
          onChange={(value) => setConfig("configHandlingMode", value)}
          options={[
            { value: "integrated", label: "集成导出" },
            { value: "separated", label: "分离导出" },
            { value: "none", label: "不导出" },
          ]}
        />
      </div>
    </>
  );
});

export default PanelConfigSection;
