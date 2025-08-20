import style from "./styles/App.module.less";

import { Flex, Layout, Splitter } from "antd";
const { Header: HeaderSection, Content } = Layout;

import Header from "./components/Header";
import MainFlow from "./components/Flow";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/FieldPanel";
import ToolPanel from "./components/panels/ToolPanel";
import FilePanel from "./components/panels/FilePanel";

function App() {
  return (
    <Flex className={style.container} gap="middle" wrap>
      <Layout className={style.layout}>
        <HeaderSection className={style.header}>
          <Header />
        </HeaderSection>
        <Content className={style.content}>
          <FilePanel />
          <Splitter className={style.workspace}>
            <Splitter.Panel className={style.left}>
              <MainFlow />
              <FieldPanel />
              <ToolPanel.AddPanel />
            </Splitter.Panel>
            <Splitter.Panel defaultSize={350} min={300} max="50%" collapsible>
              <JsonViewer />
            </Splitter.Panel>
          </Splitter>
        </Content>
      </Layout>
    </Flex>
  );
}

export default App;
