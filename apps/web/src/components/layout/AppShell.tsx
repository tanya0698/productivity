import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Drawer, Flex, Grid, Layout, Menu, Segmented, Tooltip, type MenuProps } from "antd";
import {
  CloudOutlined,
  DisconnectOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  DesktopOutlined,
  HomeOutlined,
  SaveOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { SyncStatus } from "@productivity/sync-engine";
import { useSyncStatus } from "@productivity/sync-engine/react";
import { getModules, findModuleByPath } from "@/shared/modules/registry";
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
    <Flex vertical gap={16}>
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
        text: status.reason === "conflict" ? "Needs attention — conflict" : "Needs attention — sync stopped",
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
