import style from "./styles/App.module.less";

import { Flex, Layout, Splitter } from "antd";
const { Header: HeaderSection, Content } = Layout;

import Header from "./components/Header";
import Editor from "./components/Editor";
import JsonViewer from "./components/JsonViewer";

function App() {
  return (
    <Flex className={style.container} gap="middle" wrap>
      <Layout>
        <HeaderSection className={style.header}>
          <Header />
        </HeaderSection>
        <Content className={style.content}>
          <Splitter>
            <Splitter.Panel>
              <Editor />
            </Splitter.Panel>
            <Splitter.Panel defaultSize="20%" min="10%" max="50%" collapsible>
              <JsonViewer />
            </Splitter.Panel>
          </Splitter>
        </Content>
      </Layout>
    </Flex>
  );
}

export default App;
