import { lazy, memo, Suspense } from "react";
import { Spin } from "antd";
import type { EditorProps } from "@monaco-editor/react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

function EditorLoading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
      <Spin size="small" />
    </div>
  );
}

export const MfwJsonEditor = memo((props: EditorProps) => {
  return (
    <Suspense fallback={<EditorLoading />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
});

export default MfwJsonEditor;
