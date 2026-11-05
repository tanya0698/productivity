import type { ReactNode } from "react";
import { Flex, Typography } from "antd";

/**
 * The frame every module page sits in: title, optional actions, then content
 * on the solid working sheet (glass belongs to the shell, not to pages).
 */
export function ModulePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap gap={12}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
        </div>
        {actions}
      </Flex>
      {children}
    </Flex>
  );
}
