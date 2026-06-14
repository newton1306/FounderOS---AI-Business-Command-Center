import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./app/App";
import "./styles/app.css";

function ResponsiveToaster() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 820);

  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 820);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return <Toaster position={isMobile ? "top-center" : "top-right"} richColors closeButton />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <ResponsiveToaster />
    </BrowserRouter>
  </React.StrictMode>
);
