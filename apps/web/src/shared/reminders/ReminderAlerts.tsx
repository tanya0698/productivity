import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button, Flex } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { alertKey, dismissReminder, snoozeReminder } from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { useActiveReminders, useNow, whenText, type ActiveReminder } from "./activeReminders";

const SEEN_KEY = "productivity:alerted";

/** Alerts already shown, shared across this browser's tabs so two tabs don't both alert. */
function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function markSeen(key: string) {
  try {
    const keys = [...seen(), key].slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
  } catch {
    /* storage blocked: this tab still remembers in memory */
  }
}

/**
 * Shows each due reminder once, while the app is open (plan §8.2: the PWA's
 * reminders are best-effort). In the page: a notification with Snooze and
 * Dismiss. When the tab is in the background and permission was given: a
 * browser notification too. Renders nothing itself.
 */
export function ReminderAlerts() {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { notification } = AntApp.useApp();
  const now = useNow(15_000);
  const { items, loading } = useActiveReminders(now);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (loading) return;
    const already = seen();
    for (const item of items) {
      if (item.at.getTime() > now.getTime()) break; // sorted: the rest are later
      const key = alertKey(item.reminder, now);
      if (!key || shown.current.has(key) || already.has(key)) continue;
      shown.current.add(key);
      markSeen(key);
      showAlert(item, key);
    }

    function showAlert(item: ActiveReminder, key: string) {
      const close = () => notification.destroy(key);
      const open = () => {
        close();
        navigate(item.task ? `/tasks?task=${item.task.id}` : item.note ? `/notes?note=${item.note.id}` : "/reminders");
      };
      notification.open({
        key,
        duration: 0,
        icon: <BellOutlined style={{ color: "var(--pp-primary)" }} />,
        title: (
          <button type="button" className="pp-alert-title" onClick={open}>
            {item.title}
          </button>
        ),
        description: whenText(item.at, new Date()),
        actions: (
          <Flex gap={8}>
            <Button
              size="small"
              onClick={() => {
                const t = new Date();
                void runtime.write("reminder", snoozeReminder(item.reminder, new Date(t.getTime() + 10 * 60_000), t));
                close();
              }}
            >
              Snooze 10 min
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                void runtime.write("reminder", dismissReminder(item.reminder, new Date()));
                close();
              }}
            >
              Dismiss
            </Button>
          </Flex>
        ),
      });
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        try {
          // `tag` makes the OS replace rather than stack a duplicate from another tab.
          const n = new Notification(item.title, { body: whenText(item.at, new Date()), tag: key, icon: "/icon.svg" });
          n.onclick = () => {
            window.focus();
            open();
            n.close();
          };
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    }
  }, [items, loading, now, notification, navigate, runtime]);

  return null;
}
