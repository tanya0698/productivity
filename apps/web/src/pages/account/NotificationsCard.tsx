import { useEffect, useState } from "react";
import { Alert, App as AntApp, Button, Card, Flex, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { currentPushState, disablePush, enablePush, type PushState } from "@/shared/push/push";

const COPY: Record<PushState, { badge: string; text: string }> = {
  on: { badge: "On", text: "Reminders reach this browser even when Creedence is closed." },
  off: { badge: "Off", text: "Reminders show only while Creedence is open. Turn this on to get them with the app closed." },
  denied: {
    badge: "Blocked",
    text: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  },
  unsupported: { badge: "Not available", text: "This browser can't receive push notifications. Reminders still show while the app is open." },
};

/** Push notifications on this browser: on or off. Each browser decides for itself. */
export function NotificationsCard() {
  const { getAccessToken } = useAuth();
  const { message } = AntApp.useApp();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void currentPushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      const result = await enablePush(await getAccessToken());
      if (result === "unavailable") throw new Error("Push isn't set up on the server yet.");
      setState(result);
      if (result === "on") void message.success("Notifications on for this browser");
    });
  const turnOff = () =>
    run(async () => {
      await disablePush(await getAccessToken());
      setState("off");
      void message.success("Notifications off for this browser");
    });

  const copy = state ? COPY[state] : null;
  return (
    <Card
      title="Notifications"
      className="pp-card"
      extra={copy ? <span className={`pp-badge${state === "on" ? " pp-badge-success" : ""}`}>{copy.badge}</span> : null}
    >
      <Flex vertical gap={14}>
        <Typography.Text type="secondary">{copy?.text ?? "Checking this browser…"}</Typography.Text>
        {error ? <Alert type="error" showIcon title={error} /> : null}
        <Flex gap={8} wrap>
          {state === "off" ? (
            <Button type="primary" icon={<BellOutlined />} loading={busy} onClick={() => void turnOn()}>
              Turn on for this browser
            </Button>
          ) : null}
          {state === "on" ? (
            <Button loading={busy} onClick={() => void turnOff()}>
              Turn off for this browser
            </Button>
          ) : null}
        </Flex>
      </Flex>
    </Card>
  );
}
