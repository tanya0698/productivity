import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button } from "antd";
import { HourglassOutlined } from "@ant-design/icons";
import { clock, isFinished, remainingMs } from "@productivity/domain";
import { useFocus, useTicking } from "./useFocus";
import { useNotifications } from "../notifications/store";

/**
 * Finishes the focus timer when it runs out, on whatever page is open: saves
 * the session and says so (plus a browser notification if the tab is in the
 * background and that's allowed). Renders nothing.
 */
export function FocusWatcher() {
  const { timer, complete } = useFocus();
  const { notification } = AntApp.useApp();
  const navigate = useNavigate();
  const now = useTicking(!!timer?.runningSince);
  const { store: inbox } = useNotifications();

  useEffect(() => {
    if (!timer || !isFinished(timer, now)) return;
    complete(timer);
    const focus = timer.kind === "focus";
    const title = focus ? `Focus done: ${timer.plannedMinutes} minutes` : "Break over";
    const body = focus ? "Time for a break." : "Ready for the next session?";
    inbox.add({ id: `focus-${timer.sessionId}`, kind: "focus", title, body, href: "/focus" });
    notification.open({
      key: `focus-${timer.sessionId}`,
      icon: <HourglassOutlined style={{ color: "var(--pp-primary)" }} />,
      title,
      description: body,
      duration: 0,
      actions: (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            notification.destroy(`focus-${timer.sessionId}`);
            navigate("/focus");
          }}
        >
          Open focus
        </Button>
      ),
    });
    if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, tag: `focus-${timer.sessionId}`, icon: "/icon-192.png" });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
    // `complete` and the rest are stable enough; re-running on every tick is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, now]);

  // The tab title shows the countdown, so it's visible from other tabs.
  useEffect(() => {
    if (!timer) return;
    const base = document.title;
    document.title = `${clock(remainingMs(timer, now))} · ${timer.kind === "focus" ? "Focus" : "Break"}${timer.runningSince ? "" : " (paused)"}`;
    return () => {
      document.title = base;
    };
  }, [timer, now]);

  return null;
}
