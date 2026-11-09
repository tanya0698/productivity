import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Empty, Flex, Popover, Tooltip } from "antd";
import { BellOutlined, CheckOutlined, CloudSyncOutlined, HourglassOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { whenText } from "../reminders/activeReminders";
import { useNotifications, type AppNotification, type NotificationKind } from "./store";

const kindIcon: Record<NotificationKind, React.ReactNode> = {
  reminder: <BellOutlined />,
  focus: <HourglassOutlined />,
  sync: <CloudSyncOutlined />,
  info: <InfoCircleOutlined />,
};

/** The header's notification centre: recent alerts, unread first-class, each one a way to what it's about. */
export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unread, store } = useNotifications();
  const [open, setOpen] = useState(false);
  const now = new Date();
  // Ring the bell when the unread count goes up (adjusted during render, not in an effect).
  const [seen, setSeen] = useState(unread);
  const [ring, setRing] = useState(0);
  if (unread !== seen) {
    if (unread > seen) setRing((r) => r + 1);
    setSeen(unread);
  }

  const go = (n: AppNotification) => {
    store.markRead(n.id);
    setOpen(false);
    if (n.href) navigate(n.href);
  };

  const panel = (
    <div className="pp-notif-panel">
      <Flex align="center" justify="space-between" className="pp-notif-head">
        <span className="pp-label">Notifications{unread ? ` · ${unread} new` : ""}</span>
        {unread ? (
          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => store.markAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </Flex>
      {items.length ? (
        <ul className="pp-notif-list" aria-label="Notifications">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={`pp-notif-item${n.read ? "" : " pp-notif-unread"}`} onClick={() => go(n)}>
                <span className={`pp-notif-icon pp-notif-${n.kind}`} aria-hidden>
                  {kindIcon[n.kind]}
                </span>
                <span className="pp-notif-text">
                  <span className="pp-notif-title">{n.title}</span>
                  {n.body ? <span className="pp-notif-body">{n.body}</span> : null}
                  <span className="pp-notif-time">{whenText(new Date(n.at), now)}</span>
                </span>
                {n.read ? null : <span className="pp-notif-dot" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You're all caught up." style={{ margin: "24px 0" }} />
      )}
      {items.length ? (
        <Flex justify="space-between" className="pp-notif-foot">
          <Button size="small" type="link" onClick={() => {
              setOpen(false);
              navigate("/reminders");
            }}>
            Reminders
          </Button>
          <Button size="small" type="text" onClick={() => store.clear()}>
            Clear all
          </Button>
        </Flex>
      ) : null}
    </div>
  );

  const label = unread ? `Notifications: ${unread} new` : "Notifications";
  return (
    <Popover
      content={panel}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      styles={{ container: { padding: 0 } }}
      destroyOnHidden
    >
      <Tooltip title={open ? null : label}>
        <Badge count={unread} size="small" offset={[-4, 4]}>
          <Button
            type="text"
            icon={<span key={ring} className={ring ? "pp-bell-ring" : undefined}><BellOutlined /></span>}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
          />
        </Badge>
      </Tooltip>
    </Popover>
  );
}

