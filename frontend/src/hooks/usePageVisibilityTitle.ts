import { useEffect, useRef } from "react";

export function usePageVisibilityTitle(
  awayTitle = "Te extrañamos, vuelve pronto!"
) {
  const originalTitle = useRef(document.title);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        originalTitle.current = document.title;
        document.title = awayTitle;
      } else {
        document.title = originalTitle.current;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [awayTitle]);
}
