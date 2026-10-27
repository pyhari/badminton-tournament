import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { applyTheme } from "./App.jsx";
import { start, VIEW } from "./lib/store.js";
// Fonts are bundled with the app, so the first screen needs no trip to another server.
import "@fontsource-variable/inter/wght.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "./styles.css";

applyTheme((() => { try { return localStorage.getItem("bt_theme") || "light"; } catch (e) { return "light"; } })());
if (VIEW) {
  document.title = "Live scores · Badminton Day";
  // Added to a home screen from the player page, the app opens on the player page.
  document.querySelector('link[rel="manifest"]').href = "/manifest-watch.webmanifest";
}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
start();

// Keeps the app on the phone, so it opens at once next time and still opens
// with a weak signal at the venue. Not in development, where files change constantly.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
