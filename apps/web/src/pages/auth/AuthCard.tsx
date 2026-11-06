import type { ReactNode } from "react";
import { Flex, Typography } from "antd";

/** The centred card every signed-out and in-between screen uses: sign in, code, new password. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: 16 }}>
      <div className="pp-tile" style={{ width: "100%", maxWidth: 400, padding: 32, gap: 20 }}>
        <Flex align="center" gap={10}>
          <img src="/icon.svg" alt="" width={32} height={32} />
          <span className="pp-label pp-label-brand" style={{ fontSize: 13 }}>
            Productivity
          </span>
        </Flex>
        <div>
          <Typography.Title level={1} style={{ margin: 0, fontSize: 30 }}>
            {title}
          </Typography.Title>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
        {children}
      </div>
    </Flex>
  );
}
