import { memo } from "react";
import type { EditorProps } from "@monaco-editor/react";

import { LazyFeature } from "@/components/async/LazyFeature";

const loadMonacoEditor = () => import("./MonacoEditorFeature");

export const MfwJsonEditor = memo((props: EditorProps) => {
  return (
    <LazyFeature
      loader={loadMonacoEditor}
      loadingLabel="正在加载 JSON 编辑器功能包"
      componentProps={props}
      mode="inline"
    />
  );
});

export default MfwJsonEditor;
