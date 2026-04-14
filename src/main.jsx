import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Landing, { PrivacyModal } from "./Landing.jsx";

const STORAGE_KEY = "smtm_entered";

function Root() {
  const [view, setView] = useState(null); // null = loading, "landing", "app", "privacy"

  useEffect(() => {
    const entered = localStorage.getItem(STORAGE_KEY);
    // If user has entered before, go straight to app
    setView(entered ? "app" : "landing");
  }, []);

  const handleEnter = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setView("app");
  };

  // Brief blank while checking localStorage
  if (view === null) return null;
  if (view === "landing") return <Landing onEnter={handleEnter} />;
  if (view === "privacy") return (
    <>
      <App />
      <PrivacyModal onClose={() => setView("app")} />
    </>
  );
  return <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
