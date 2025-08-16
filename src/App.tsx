import style from "./styles/App.module.less";

import { Flex, Layout, Splitter } from "antd";
const { Header: HeaderSection, Content } = Layout;

import Header from "./components/Header";
import Editor from "./components/Editor";
import JsonViewer from "./components/JsonViewer";
import FieldPanel from "./components/panels/FieldPanel";
import ToolPanel from "./components/panels/ToolPanel";

function App() {
  return (
    <Flex className={style.container} gap="middle" wrap>
      <Layout>
        <HeaderSection className={style.header}>
          <Header />
        </HeaderSection>
        <Content className={style.content}>
          <Splitter>
            <Splitter.Panel className={style.left}>
              <Editor />
              <FieldPanel />
              <ToolPanel.AddPanel />
            </Splitter.Panel>
            {/* <Splitter.Panel defaultSize="20%" min="0%" max="50%" collapsible>
              <JsonViewer />
            </Splitter.Panel> */}
          </Splitter>
        </Content>
      </Layout>
    </Flex>
  );
}

export default App;
