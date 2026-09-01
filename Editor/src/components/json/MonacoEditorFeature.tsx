import MonacoEditor, {
  loader,
  type EditorProps,
} from "@monaco-editor/react";

loader.config({
  paths: {
    vs: `${import.meta.env.BASE_URL}monaco-editor/min/vs`,
  },
});

export default function MonacoEditorFeature(props: EditorProps) {
  return <MonacoEditor {...props} />;
}

