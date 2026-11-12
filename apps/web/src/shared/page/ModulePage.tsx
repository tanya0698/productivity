import type { ReactNode } from "react";
import { Flex, Typography } from "antd";

/**
 * The frame every module page sits in, in the portfolio's style: a small mono
 * label, a heavy title, a slate description, then the content.
 */
export function ModulePage({
  eyebrow,
  title,
  description,
  actions,
  back,
  children,
}: {
  /** A way back up, shown above the eyebrow (e.g. "All projects" on a project). */
  back?: ReactNode;
  /** Small uppercase mono label above the title, like "ELTON CHIPUKA". */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-end" wrap gap={12}>
        <Flex vertical gap={6}>
          {back}
          {eyebrow ? <span className="pp-label pp-label-brand">{eyebrow}</span> : null}
          <Typography.Title level={1} style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Text type="secondary" style={{ fontSize: 15, maxWidth: 640 }}>
              {description}
            </Typography.Text>
          ) : null}
        </Flex>
        {actions}
      </Flex>
      {children}
    </Flex>
  );
}
