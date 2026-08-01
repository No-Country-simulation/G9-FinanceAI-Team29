import { useEffect, useRef } from "react";
import { getAgentTabStatus, setAgentTabStatus, subscribeAgentTabStatus } from "../utils/tabTitle";

export function usePageVisibilityTitle(
  awayTitle = "Te extrañamos, vuelve pronto!"
) {
  const originalTitle = useRef(document.title);

  useEffect(() => {
    const applyHiddenTitle = () => {
      document.title = getAgentTabStatus() ?? awayTitle;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        originalTitle.current = document.title;
        applyHiddenTitle();
      } else {
        document.title = originalTitle.current;
        setAgentTabStatus(null);
      }
    };

    const unsubscribeAgentStatus = subscribeAgentTabStatus(() => {
      if (document.hidden) applyHiddenTitle();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeAgentStatus();
    };
  }, [awayTitle]);
}
