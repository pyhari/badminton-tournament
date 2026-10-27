import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { start, VIEW } from "./lib/store.js";
import "./styles.css";

document.documentElement.dataset.theme = (() => { try { return localStorage.getItem("bt_theme") || "dark"; } catch (e) { return "dark"; } })();
if (VIEW) document.title = "Live scores · Badminton Day";
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
start();
