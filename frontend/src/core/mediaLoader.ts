import { useEffect, useState } from "react";

export function useMediaLoaded(id: string, type: "image" | "video") {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = document.getElementById(id);

    if (!el) return;

    if (type === "image" && (el as HTMLImageElement).complete) {
      setLoaded(true);
    }

    if (
      type === "video" &&
      (el as HTMLVideoElement).readyState >= 2
    ) {
      setLoaded(true);
    }

    const handleLoad = () => setLoaded(true);

    el.addEventListener(
      type === "image" ? "load" : "loadeddata",
      handleLoad
    );

    return () => {
      el.removeEventListener(
        type === "image" ? "load" : "loadeddata",
        handleLoad
      );
    };
  }, [id, type]);

  return loaded;
}
