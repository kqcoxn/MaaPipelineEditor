import { describe, expect, it } from "vitest";
import { recoParamKeys } from "../../core/fields";
import {
  setMfwJsonCompletionContext,
  createMfwCompletionProvider,
  createMfwJsonEditorOptions,
} from "./mfwJsonCompletion";

interface MockModel {
  getValue(): string;
  getLineContent(lineNumber: number): string;
  getOffsetAt(position: { lineNumber: number; column: number }): number;
}

function createMockModel(text: string): MockModel {
  const lines = text.split("\n");
  return {
    getValue: () => text,
    getLineContent: (lineNumber) => lines[lineNumber - 1] ?? "",
    getOffsetAt: ({ lineNumber, column }) => {
      let offset = 0;
      for (let index = 0; index < lineNumber - 1; index += 1) {
        offset += (lines[index]?.length ?? 0) + 1;
      }
      return offset + column - 1;
    },
  };
}

function findRecognitionContextPair(): {
  recognitionType: string;
  expectedField: string;
  excludedField: string;
} {
  const fieldCounts = new Map<string, number>();
  for (const keys of Object.values(recoParamKeys)) {
    for (const key of keys.all ?? []) {
      fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1);
    }
  }

  const uniqueByType = Object.entries(recoParamKeys)
    .map(([type, keys]) => ({
      type,
      uniqueFields: (keys.all ?? []).filter((key) => fieldCounts.get(key) === 1),
    }))
    .filter((entry) => entry.uniqueFields.length > 0);

  if (uniqueByType.length < 2) {
    throw new Error("Expected at least two recognition types with unique fields");
  }

  return {
    recognitionType: uniqueByType[0].type,
    expectedField: uniqueByType[0].uniqueFields[0],
    excludedField: uniqueByType[1].uniqueFields[0],
  };
}

async function collectSuggestionLabels(
  text: string,
  lineNumber: number,
  column: number,
) {
  const provider = createMfwCompletionProvider();
  const result = await Promise.resolve(
    provider.provideCompletionItems(
      createMockModel(text) as never,
      { lineNumber, column } as never,
      {} as never,
      {} as never,
    ),
  );
  return (result?.suggestions ?? []).map((item) => String(item.label));
}

describe("createMfwCompletionProvider", () => {
  it("keeps node-json recognition context and reuses it inside override runtime objects", async () => {
    const { recognitionType, expectedField, excludedField } =
      findRecognitionContextPair();

    const nodeJsonLabels = await collectSuggestionLabels(
      `{
  "recognition": "${recognitionType}",
  ""
}`,
      3,
      4,
    );
    expect(nodeJsonLabels).toContain(expectedField);
    expect(nodeJsonLabels).not.toContain(excludedField);

    const overrideLabels = await collectSuggestionLabels(
      `{
  "ShopEntry": {
    "recognition": "${recognitionType}",
    ""
  }
}`,
      4,
      6,
    );
    expect(overrideLabels).toContain(expectedField);
    expect(overrideLabels).not.toContain(excludedField);
  });

  it("enables quick suggestions inside JSON strings for live override editing", () => {
    const options = createMfwJsonEditorOptions(2);

    expect(options.quickSuggestions).toEqual({
      other: true,
      comments: false,
      strings: true,
    });
    expect(options.suggestOnTriggerCharacters).toBe(true);
  });

  it("supports override-only runtime-name suggestions from all files and excludes system names", async () => {
    const model = createMockModel(`{
  ""
}`);
    setMfwJsonCompletionContext(model as never, {
      nodeNameSuggestions: [
        {
          label: "ShopEntry",
          detail: "opened.json",
        },
        {
          label: "RemoteNode",
          detail: "unopened.json",
        },
      ],
    });

    const provider = createMfwCompletionProvider();
    const result = await Promise.resolve(
      provider.provideCompletionItems(
        model as never,
        { lineNumber: 2, column: 4 } as never,
        {} as never,
        {} as never,
      ),
    );
    const labels = (result?.suggestions ?? []).map((item) => String(item.label));

    expect(labels).toContain("ShopEntry");
    expect(labels).toContain("RemoteNode");
    expect(labels).not.toContain("__mpe_tasker_bootstrap__");
  });
});
