import { beforeEach, describe, expect, it } from "vitest";

import { useResourceStore } from "./resourceStore";

describe("resourceStore", () => {
  beforeEach(() => useResourceStore.getState().clear());

  it("tracks image request and cache state", () => {
    const store = useResourceStore.getState();
    store.setPendingImageRequest("image/start.png", true);
    expect(useResourceStore.getState().isImagePending("image/start.png")).toBe(true);

    store.setImageCache("image/start.png", {
      base64: "blob:test",
      mimeType: "image/png",
      width: 16,
      height: 16,
      bundleName: "main",
      absPath: "C:/project/image/start.png",
      timestamp: 1,
    });

    expect(useResourceStore.getState().isImagePending("image/start.png")).toBe(false);
    expect(useResourceStore.getState().getImageCache("image/start.png")).toMatchObject({
      bundleName: "main",
      width: 16,
    });
  });

  it("clears project-scoped resource state", () => {
    useResourceStore.getState().setResourceBundles(
      [
        {
          abs_path: "C:/project/resource",
          rel_path: "resource",
          name: "resource",
          has_pipeline: true,
          has_image: true,
          has_model: false,
          has_default_pipeline: false,
          image_dir: "C:/project/resource/image",
          pipeline_path: "resource/pipeline",
          sources: [],
        },
      ],
      ["C:/project/resource/image"],
    );

    useResourceStore.getState().clear();

    expect(useResourceStore.getState()).toMatchObject({
      resourceBundles: [],
      imageDirs: [],
      imageList: [],
    });
  });
});
