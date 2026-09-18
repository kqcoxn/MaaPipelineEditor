// Install before Editor loads so every installed Editor version gets the shortcut.
if (window === window.top) {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "F12") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    void window.__TAURI__.core.invoke("desktop_open_devtools").catch((error) => {
      console.error("无法打开开发者工具", error);
    });
  }, true);
}
