import { XProvider } from "@ant-design/x";
import xZhCN from "@ant-design/x/locale/zh_CN";
import antdZhCN from "antd/locale/zh_CN";

import AIHistoryPanel from "@/components/panels/main/AIHistoryPanel";

export default function AIHistoryFeature() {
  return (
    <XProvider locale={{ ...antdZhCN, ...xZhCN }}>
      <AIHistoryPanel />
    </XProvider>
  );
}

