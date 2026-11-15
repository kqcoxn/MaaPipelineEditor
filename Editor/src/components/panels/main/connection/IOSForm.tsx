import { Alert, Form, Input, Select } from "antd";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { iosConfigError, type IOSControllerOptions } from "@/services/protocols/iosController";

interface Props {
  value: IOSControllerOptions;
  onChange: (value: IOSControllerOptions) => void;
}

export function IOSForm({ value, onChange }: Props) {
  const devices = useMFWStore(s => s.iosDevices);
  const pending = useMFWStore(s => s.iosDiscoveryPending);
  const error = useMFWStore(s => s.iosDiscoveryError);
  const warnings = useMFWStore(s => s.iosDiscoveryWarnings);
  const configError = iosConfigError(value.config);
  return <Form layout="vertical" component="div">
    <Alert type="info" showIcon title="连接 iPhone / iPad 真机" style={{ marginBottom: 16 }}
      description="请先安装 XDeviceBridge，将 xdb 加入 PATH，并完成设备配对和 DDI 准备。需要 xdb Server 1.6.0 或更新版本；设备发现不会自动配对。" />
    {error && <Alert type="error" showIcon title="设备发现失败" description={error} style={{ marginBottom: 16 }} />}
    {warnings.length > 0 && <Alert type="warning" showIcon title="设备发现提示" description={warnings.map(warning => typeof warning === "string" ? warning : JSON.stringify(warning)).join("；")} style={{ marginBottom: 16 }} />}
    <Form.Item label="已发现设备" htmlFor="ios-device" extra="也可在下方手动填写 UDID。切换连接方式或服务端口后点击刷新。">
      <Select id="ios-device" loading={pending} value={devices.some(device => device.udid === value.udid) ? value.udid : undefined}
        placeholder={pending ? "正在发现设备…" : "选择设备"} options={devices.map(device => ({ value: device.udid, label: `${device.name || device.udid} · ${device.state}` }))}
        onChange={udid => onChange({ ...value, udid })} />
    </Form.Item>
    <Form.Item label="设备 UDID" htmlFor="ios-udid" required validateStatus={value.udid.includes("\0") ? "error" : undefined}
      help={value.udid.includes("\0") ? "UDID 不能包含 NUL" : undefined}>
      <Input id="ios-udid" value={value.udid} onChange={event => onChange({ ...value, udid: event.target.value })} />
    </Form.Item>
    <Form.Item label="连接方式" htmlFor="ios-connection">
      <Select id="ios-connection" value={value.connection} options={["Auto", "USB", "WiFi"].map(method => ({ value: method, label: method }))}
        onChange={connection => onChange({ ...value, connection })} />
    </Form.Item>
    <Form.Item label="截图方式" htmlFor="ios-screencap" required validateStatus={!value.screencap_methods.length ? "error" : undefined}
      help={!value.screencap_methods.length ? "请至少选择一种截图方式" : undefined}
      extra="Stream 优先视频；同时选择 ScreenshotService 时可回退到无损截图。仅选 ScreenshotService 不启动视频。">
      <Select id="ios-screencap" mode="multiple" value={value.screencap_methods}
        options={["Stream", "ScreenshotService"].map(method => ({ value: method, label: method }))}
        onChange={screencap_methods => onChange({ ...value, screencap_methods })} />
    </Form.Item>
    <Form.Item label="连接配置（JSON）" htmlFor="ios-config" validateStatus={configError ? "error" : undefined} help={configError}
      extra={'可设置 server_port、wifi_address、wifi_port、shared_control、max_bitrate、max_fps（0..240）、hardware_decode。Auto 下 wifi_address 留空优先 USB，填 "auto" 仅尝试 Wi-Fi。'}>
      <Input.TextArea id="ios-config" aria-describedby={configError ? "ios-config-error" : undefined} value={value.config} autoSize={{ minRows: 4, maxRows: 10 }}
        onChange={event => onChange({ ...value, config: event.target.value })} />
      {configError && <span id="ios-config-error" hidden>{configError}</span>}
    </Form.Item>
  </Form>;
}
