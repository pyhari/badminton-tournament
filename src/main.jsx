import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { applyTheme } from "./App.jsx";
import { start, VIEW } from "./lib/store.js";
import { startInsights } from "./lib/insightsFeed.js";
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
// If a screen crashes, say so and offer a way out, instead of leaving a blank page.
class Crash extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    // Keeps the login, theme and preferences; drops this device's copy of the tournament,
    // which loads again from the server.
    const fresh = () => { try { ["bt_tournament_v1", "bt_watch_v1", "bt_rev", "bt_dirty", "bt_filter"].forEach(k => localStorage.removeItem(k)); } catch (x) {} location.reload(); };
    return (
      <div className="page crash">
        <h1 className="page-title">Something went wrong</h1>
        <p>The app hit an error on this device. Scores saved on the server are safe.</p>
        <pre>{String(e && e.message || e)}</pre>
        <div className="btns">
          <button className="btn primary" onClick={() => location.reload()}>Reload</button>
          <button className="btn" onClick={fresh}>Load again from the server</button>
        </div>
      </div>
    );
  }
}
createRoot(document.getElementById("root")).render(<StrictMode><Crash><App /></Crash></StrictMode>);
start();
startInsights();

// A page saved before a new version went live can ask for files that are gone: reload once
// to get the new version, instead of failing.
addEventListener("vite:preloadError", e => {
  try { if (sessionStorage.getItem("bt_reloaded")) return; sessionStorage.setItem("bt_reloaded", "1"); } catch (x) { return; }
  e.preventDefault(); location.reload();
});

// Keeps the app on the phone, so it opens at once next time and still opens
// with a weak signal at the venue. Not in development, where files change constantly.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
