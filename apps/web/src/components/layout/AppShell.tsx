import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Drawer, Flex, Grid, Layout, Menu, Segmented, Tooltip, Typography, type MenuProps } from "antd";
import {
  CloudOutlined,
  DisconnectOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  DesktopOutlined,
  HomeOutlined,
  LogoutOutlined,
  SafetyOutlined,
  SaveOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { SyncStatus } from "@productivity/sync-engine";
import { useSyncStatus } from "@productivity/sync-engine/react";
import { getModules, findModuleByPath } from "@/shared/modules/registry";
import { useAuth } from "@/shared/auth/AuthProvider";
import { useTheme, type ColorModeSetting } from "@/contexts/ThemeProvider";
import { SearchPalette } from "@/shared/search/SearchPalette";
import { ReminderAlerts } from "@/shared/reminders/ReminderAlerts";
import { ReminderBell } from "@/shared/reminders/ReminderBell";
import { FocusPill } from "@/shared/focus/FocusPill";
import { FocusWatcher } from "@/shared/focus/FocusWatcher";

const SIDER_WIDTH = 232;
const shortcutLabel = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

/**
 * The app frame (plan §4.1, §4.4): gradient behind everything, glass sidebar
 * and header, and a solid sheet where pages render. The sidebar is built from
 * the module registry, so a new module folder adds its own entry.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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

  const nav = <SidebarNav onNavigate={() => setDrawerOpen(false)} showColorMode={isMobile} />;

  return (
    // Transparent all the way down, so the ink background and its glows (global.css) show through.
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size={SIDER_WIDTH + 24}
          styles={{ body: { padding: 12 } }}
        >
          {nav}
        </Drawer>
      ) : (
        // No panel: the menu floats on the ink like the portfolio's navigation; only the selected item is tinted.
        <Layout.Sider
          width={SIDER_WIDTH}
          style={{ padding: "20px 12px", height: "100vh", position: "sticky", top: 0 }}
        >
          {nav}
        </Layout.Sider>
      )}

      <Layout style={{ background: "transparent" }}>
        <Layout.Header
          style={{ height: "auto", lineHeight: "normal", padding: isMobile ? "14px 16px" : "20px 32px 4px", maxWidth: 1180 }}
        >
          <Flex align="center" gap={12}>
            {isMobile ? (
              <>
                <Button type="text" icon={<MenuOutlined />} aria-label="Open navigation" onClick={() => setDrawerOpen(true)} />
                <span className="pp-label pp-label-brand pp-brand-mobile">Productivity</span>
              </>
            ) : (
              <button type="button" className="pp-search-trigger pp-glass" onClick={() => setSearchOpen(true)} aria-label="Search (Ctrl+K)">
                <SearchOutlined />
                <span>Search</span>
                <kbd>{shortcutLabel}</kbd>
              </button>
            )}
            {/* marginLeft auto, not space-between: antd's Flex renders nothing for an empty group. */}
            <Flex align="center" gap={8} style={{ marginLeft: "auto" }}>
              {isMobile ? <Button type="text" icon={<SearchOutlined />} aria-label="Search" onClick={() => setSearchOpen(true)} /> : null}
              <FocusPill />
              <ReminderBell />
              <SyncPill />
              {/* On phones the colour switch lives in the navigation drawer, so the header fits. */}
              {isMobile ? null : <ColorModeSwitch />}
            </Flex>
          </Flex>
        </Layout.Header>

        <Layout.Content
          style={{
            padding: isMobile ? "8px 16px 24px" : "12px 32px 40px",
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
    </Layout>
  );
}

function SidebarNav({ onNavigate, showColorMode }: { onNavigate: () => void; showColorMode: boolean }) {
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
        <img src="/icon.svg" alt="" width={28} height={28} />
        <span className="pp-label pp-label-brand" style={{ fontSize: 13 }}>
          Productivity
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
      {/* One block pinned to the bottom: colour mode (phones only), then the account. */}
      <Flex vertical gap={12} style={{ marginTop: "auto" }}>
        {showColorMode ? (
          <Flex align="center" justify="space-between" style={{ padding: "0 8px" }}>
            <span className="pp-label" style={{ fontSize: 10 }}>
              Colour mode
            </span>
            <ColorModeSwitch />
          </Flex>
        ) : null}
        <AccountFooter onNavigate={onNavigate} />
      </Flex>
    </Flex>
  );
}

/** Who's signed in, account settings, and the way out. Sits at the bottom of the navigation. */
function AccountFooter({ onNavigate }: { onNavigate: () => void }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Flex
      vertical
      gap={8}
      style={{ padding: "12px 8px 4px", borderTop: "1px solid var(--pp-border)" }}
    >
      <span className="pp-label" style={{ fontSize: 10 }}>
        Signed in as
      </span>
      <Typography.Text ellipsis style={{ fontSize: 13 }} title={session?.user.email ?? undefined}>
        {session?.user.email ?? "Unknown account"}
      </Typography.Text>
      <Flex gap={8} wrap>
        <Button
          size="small"
          icon={<SafetyOutlined />}
          onClick={() => {
            navigate("/account");
            onNavigate();
          }}
        >
          Account
        </Button>
        <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()}>
          Sign out
        </Button>
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
    <button
      type="button"
      className="pp-glass pp-sync-pill"
      onClick={() => navigate("/sync")}
      title="Sync details"
      aria-label={`${full}. Open sync details`}
    >
      <span role="status" style={{ display: "contents" }}>
        {icon}
        <span className="pp-label" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
          {text}
        </span>
      </span>
    </button>
  );
}

function ColorModeSwitch() {
  const { setting, setSetting } = useTheme();
  return (
    <Tooltip title="Colour mode">
      <Segmented<ColorModeSetting>
        size="small"
        value={setting}
        onChange={setSetting}
        options={[
          { value: "light", icon: <SunOutlined />, title: "Light" },
          { value: "system", icon: <DesktopOutlined />, title: "Match system" },
          { value: "dark", icon: <MoonOutlined />, title: "Dark" },
        ]}
      />
    </Tooltip>
  );
}
