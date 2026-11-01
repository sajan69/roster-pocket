import { useEffect, useState } from "react";
export function useOffline() {
  const [ready, setReady] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI))
        .then(() => navigator.serviceWorker.ready)
        .then(() => setReady(true))
        .catch(() => {});
    }
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  return { ready, online };
}
