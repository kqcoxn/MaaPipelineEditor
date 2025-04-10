import "./style.css";
import "./components/edge/style.css"

// vue
import { createApp } from "vue";
import App from "./App.vue";
const app = createApp(App);

// element-plus
import "element-plus/dist/index.css";

// pinia
import { createPinia } from "pinia";
const pinia = createPinia();
app.use(pinia);

app.mount("#app");
