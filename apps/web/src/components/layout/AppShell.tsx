import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Drawer, Flex, Grid, Layout, Menu, Tooltip, Typography, type MenuProps } from "antd";
import {
  CloudOutlined,
  DisconnectOutlined,
  MenuOutlined,
  
  
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
  SaveOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { SyncStatus } from "@productivity/sync-engine";
import { useSyncStatus } from "@productivity/sync-engine/react";
import { getModules, findModuleByPath } from "@/shared/modules/registry";
import { useAuth } from "@/shared/auth/AuthProvider";
import { SearchPalette } from "@/shared/search/SearchPalette";
import { APP_NAME, brandImages } from "@/shared/brand";
import { displayName } from "@/shared/auth/profile";
import { ReminderAlerts } from "@/shared/reminders/ReminderAlerts";
import { NotificationBell } from "@/shared/notifications/NotificationBell";
import { SyncNotices } from "@/shared/notifications/SyncNotices";
import { FocusPill } from "@/shared/focus/FocusPill";
import { FocusWatcher } from "@/shared/focus/FocusWatcher";
import { ScrollReveal } from "./ScrollReveal";
import { ColorModeToggle } from "@/components/ui/ColorModeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { PendingAvatarUpload } from "@/shared/auth/PendingAvatarUpload";

const SIDER_WIDTH = 232;
const shortcutLabel = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

/**
 * Even spacing (the hub's rule): one gap between cards, rows and panels, the
 * same across as down, and one edge around the page on every side. Rows use
 * gutter={[16, 16]}; ModulePage stacks its sections 16 apart.
 */
export const SPACE = { gap: 16, edge: 24, edgeMobile: 16 } as const;

/**
 * The app frame (plan §4.1, §4.4): gradient behind everything, glass sidebar
 * and header, and a solid sheet where pages render. The sidebar is built from
 * the module registry, so a new module folder adds its own entry.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const edge = isMobile ? SPACE.edgeMobile : SPACE.edge;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/⌘+K anywhere, or "/" when not typing, opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = <SidebarNav onNavigate={() => setDrawerOpen(false)} />;

  return (
    // Transparent all the way down, so the ink background and its glows (global.css) show through.
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size={SIDER_WIDTH + 24}
          styles={{ body: { padding: SPACE.gap } }}
        >
          {nav}
        </Drawer>
      ) : (
        // No panel: the menu floats on the ink like the portfolio's navigation; only the selected item is tinted.
        <Layout.Sider
          width={SIDER_WIDTH}
          style={{ padding: SPACE.gap, height: "100vh", position: "sticky", top: 0 }}
        >
          {nav}
        </Layout.Sider>
      )}

      <Layout style={{ background: "transparent" }}>
        <Layout.Header
          // Even spacing: the header shares the page's edge on top and both sides; the content's own top padding is the gap below it.
          style={{ height: "auto", lineHeight: "normal", padding: `${edge}px ${edge}px 0`, maxWidth: 1180 }}
        >
          <Flex align="center" gap={12}>
            {isMobile ? (
              <>
                <Tooltip title="Menu">
                  <Button type="text" icon={<MenuOutlined />} aria-label="Open navigation" onClick={() => setDrawerOpen(true)} />
                </Tooltip>
                <span className="pp-label pp-label-brand pp-brand-mobile">{APP_NAME}</span>
              </>
            ) : (
              <Tooltip title={<>Search tasks, notes, projects and more · <kbd>{shortcutLabel}</kbd> or <kbd>/</kbd></>} mouseEnterDelay={0.4}>
                <button type="button" className="pp-search-trigger pp-glass" onClick={() => setSearchOpen(true)} aria-label={`Search (${shortcutLabel})`}>
                  <SearchOutlined />
                  <span>Search</span>
                  <kbd>{shortcutLabel}</kbd>
                </button>
              </Tooltip>
            )}
            {/* marginLeft auto, not space-between: antd's Flex renders nothing for an empty group. */}
            <Flex align="center" gap={8} style={{ marginLeft: "auto" }}>
              {isMobile ? (
                <Tooltip title="Search">
                  <Button type="text" icon={<SearchOutlined />} aria-label="Search" onClick={() => setSearchOpen(true)} />
                </Tooltip>
              ) : null}
              <FocusPill />
              <NotificationBell />
              <SyncPill />
              <ColorModeToggle />
            </Flex>
          </Flex>
        </Layout.Header>

        <Layout.Content
          style={{
            padding: edge,
            maxWidth: 1180,
            width: "100%",
            minHeight: 0,
          }}
        >
          {children}
        </Layout.Content>
      </Layout>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ReminderAlerts />
      <FocusWatcher />
      <SyncNotices />
      <ScrollReveal />
      <PendingAvatarUpload />
    </Layout>
  );
}

function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = findModuleByPath(pathname)?.key ?? (pathname === "/" ? "today" : "");

  const items: MenuProps["items"] = [
    { key: "today", icon: <HomeOutlined />, label: "Today" },
    ...getModules().map((m) => ({
      key: m.key,
      icon: m.icon,
      label: m.name,
      disabled: m.status === "soon",
    })),
  ];

  return (
    <Flex vertical gap={16} style={{ height: "100%" }}>
      <Flex align="center" gap={10} style={{ padding: "4px 8px" }}>
        <img src={brandImages.mark} alt="" width={30} height={30} />
        <span className="pp-label pp-label-brand" style={{ fontSize: 13 }}>
          {APP_NAME}
        </span>
      </Flex>
      <Menu
        mode="inline"
        selectedKeys={[current]}
        items={items}
        style={{ border: "none" }}
        onClick={({ key }) => {
          navigate(key === "today" ? "/" : (getModules().find((m) => m.key === key)?.basePath ?? "/"));
          onNavigate();
        }}
      />
      <div style={{ marginTop: "auto" }}>
        <AccountFooter onNavigate={onNavigate} />
      </div>
    </Flex>
  );
}

/** Who's signed in, account settings, and the way out. Sits at the bottom of the navigation. */
function AccountFooter({ onNavigate }: { onNavigate: () => void }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const name = displayName(session?.user);
  return (
    <Flex
      vertical
      gap={8}
      style={{ padding: "12px 8px 4px", borderTop: "1px solid var(--pp-border)" }}
    >
      <span className="pp-label" style={{ fontSize: 10 }}>
        Signed in as
      </span>
      <Tooltip title={session?.user.email} placement="right" mouseEnterDelay={0.4}>
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
          <UserAvatar user={session?.user} size={34} />
          <Flex vertical style={{ minWidth: 0 }}>
          {name ? (
            <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
              {name}
            </Typography.Text>
          ) : null}
          <Typography.Text ellipsis type={name ? "secondary" : undefined} style={{ fontSize: name ? 12 : 13 }}>
            {session?.user.email ?? "Unknown account"}
          </Typography.Text>
          </Flex>
        </Flex>
      </Tooltip>
      <Flex gap={8} wrap>
        <Button
          size="small"
          icon={<UserOutlined />}
          onClick={() => {
            navigate("/account");
            onNavigate();
          }}
        >
          Account
        </Button>
        <Tooltip title="Sign out of this device. Unsynced changes stay here until you sign back in.">
          <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </Tooltip>
      </Flex>
    </Flex>
  );
}

/** The sync states from plan §6.6, in words as well as an icon. */
function syncLabel(status: SyncStatus): { icon: ReactNode; text: string } {
  switch (status.state) {
    case "syncing":
      return { icon: <SyncOutlined spin />, text: "Syncing" };
    case "pending":
      return { icon: <SaveOutlined />, text: "Saved on this device" };
    case "offline":
      return {
        icon: <DisconnectOutlined />,
        text: status.pending ? `Offline — ${status.pending} queued` : "Offline",
      };
    case "needs_attention":
      return {
        icon: <WarningOutlined />,
        text:
          status.reason === "conflict"
            ? "Needs attention — conflict"
            : status.reason === "auth"
              ? "Sign in again to sync"
              : "Needs attention — sync stopped",
      };
    case "idle":
      return { icon: <CloudOutlined />, text: status.lastSyncedAt ? "Synced" : "Saved on this device" };
  }
}

/** The sync state, always visible; clicking it opens the sync & conflicts page. */
function SyncPill() {
  const status = useSyncStatus();
  const { icon, text: full } = syncLabel(status);
  // Phones get the short form, so the pill stays on one line beside the menu button.
  const compact = !Grid.useBreakpoint().md;
  const text = compact && status.state === "needs_attention" ? (status.reason === "conflict" ? "Conflict" : status.reason === "auth" ? "Sign in" : "Sync stopped")
    : compact && status.state === "offline" ? "Offline"
    : compact && status.state === "pending" ? "Saved"
    : full;
  const navigate = useNavigate();
  return (
    <Tooltip title={<>{full}<br />Click for sync details and conflicts.</>} mouseEnterDelay={0.3}>
      <button type="button" className="pp-glass pp-sync-pill" onClick={() => navigate("/sync")} aria-label={`${full}. Open sync details`}>
        <span role="status" style={{ display: "contents" }}>
          {icon}
          <span className="pp-label" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
            {text}
          </span>
        </span>
      </button>
    </Tooltip>
  );
}

