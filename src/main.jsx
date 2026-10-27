import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { applyTheme } from "./App.jsx";
import { start, VIEW } from "./lib/store.js";
import "./styles.css";

applyTheme((() => { try { return localStorage.getItem("bt_theme") || "light"; } catch (e) { return "light"; } })());
if (VIEW) document.title = "Live scores · Badminton Day";
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
start();
