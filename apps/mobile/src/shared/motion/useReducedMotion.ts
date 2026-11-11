import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Android's "Remove animations" (or iOS Reduce Motion): when on, nothing moves. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
