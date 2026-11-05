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
} from "@ant-design/icons";
import { getModules, findModuleByPath } from "@/shared/modules/registry";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
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
    <Layout style={{ minHeight: "100%", background: "var(--pp-gradient)" }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={SIDER_WIDTH + 24}
          styles={{ body: { padding: 12 } }}
        >
          {nav}
        </Drawer>
      ) : (
        <Layout.Sider
          width={SIDER_WIDTH}
          className="pp-glass"
          style={{ margin: 12, marginRight: 0, borderRadius: 18, padding: 12, height: "calc(100vh - 24px)", position: "sticky", top: 12 }}
        >
          {nav}
        </Layout.Sider>
      )}

      <Layout style={{ background: "transparent" }}>
        <Layout.Header style={{ height: "auto", lineHeight: "normal", padding: "16px 20px" }}>
          <Flex align="center" justify="space-between" gap={12}>
            <Flex align="center" gap={8}>
              {isMobile ? (
                <Button type="text" icon={<MenuOutlined />} aria-label="Open navigation" onClick={() => setDrawerOpen(true)} />
              ) : null}
              <HeaderTitle />
            </Flex>
            <Flex align="center" gap={8}>
              <SyncPill />
              <ColorModeSwitch />
            </Flex>
          </Flex>
        </Layout.Header>

        <Layout.Content
          style={{
            margin: isMobile ? 0 : "0 12px 12px 12px",
            padding: isMobile ? 16 : 24,
            background: "var(--pp-page)",
            border: "1px solid var(--pp-border)",
            borderRadius: isMobile ? "18px 18px 0 0" : 18,
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
        <Typography.Text strong style={{ fontSize: 16 }}>
          Productivity
        </Typography.Text>
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

function HeaderTitle() {
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return <Typography.Text type="secondary">{date}</Typography.Text>;
}

/** Placeholder until the sync engine reports real status (plan §6.6). */
function SyncPill() {
  const online = useOnlineStatus();
  return (
    <Flex
      align="center"
      gap={6}
      className="pp-glass"
      style={{ borderRadius: 999, padding: "4px 12px", fontSize: 12 }}
      role="status"
    >
      {online ? <CloudOutlined /> : <DisconnectOutlined />}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {online ? "Online" : "Offline — changes stay on this device"}
      </Typography.Text>
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
