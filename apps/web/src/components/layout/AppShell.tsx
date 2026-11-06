import { useState, type ReactNode } from "react";
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
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { SyncStatus } from "@productivity/sync-engine";
import { useSyncStatus } from "@productivity/sync-engine/react";
import { getModules, findModuleByPath } from "@/shared/modules/registry";
import { useAuth } from "@/shared/auth/AuthProvider";
import { useTheme, type ColorModeSetting } from "@/contexts/ThemeProvider";

const SIDER_WIDTH = 232;

/**
 * The app frame (plan §4.1, §4.4): gradient behind everything, glass sidebar
 * and header, and a solid sheet where pages render. The sidebar is built from
 * the module registry, so a new module folder adds its own entry.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

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
                <span className="pp-label pp-label-brand">Productivity</span>
              </>
            ) : null}
            {/* marginLeft auto, not space-between: antd's Flex renders nothing for an empty group. */}
            <Flex align="center" gap={8} style={{ marginLeft: "auto" }}>
              <SyncPill />
              <ColorModeSwitch />
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
      <AccountFooter onNavigate={onNavigate} />
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
      style={{ marginTop: "auto", padding: "12px 8px 4px", borderTop: "1px solid var(--pp-border)" }}
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

function SyncPill() {
  const { icon, text } = syncLabel(useSyncStatus());
  return (
    <Flex
      align="center"
      gap={6}
      className="pp-glass"
      style={{ borderRadius: 999, padding: "4px 12px", fontSize: 12 }}
      role="status"
    >
      {icon}
      <span className="pp-label" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
        {text}
      </span>
    </Flex>
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
