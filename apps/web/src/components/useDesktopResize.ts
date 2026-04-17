import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function getMatches() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useDesktopResize() {
  const [isDesktop, setIsDesktop] = useState(getMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return isDesktop;
}
