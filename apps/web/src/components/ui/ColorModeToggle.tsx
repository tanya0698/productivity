import { Button, Tooltip } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeProvider";

/** One button: light ↔ dark. The icon shows where it takes you, and turns as it switches. */
export function ColorModeToggle() {
  const { mode, toggle } = useTheme();
  const next = mode === "dark" ? "light" : "dark";
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <Button
        type="text"
        className="pp-mode-toggle"
        icon={<span key={mode} className="pp-mode-icon">{next === "light" ? <SunOutlined /> : <MoonOutlined />}</span>}
        aria-label={`Switch to ${next} mode`}
        onClick={toggle}
      />
    </Tooltip>
  );
}
