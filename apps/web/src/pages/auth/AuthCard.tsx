import type { ReactNode } from "react";
import { Flex, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { dark } from "@productivity/theme";

/**
 * The layout every signed-out and in-between screen uses (sign in, create
 * account, reset, code, new password): a brand panel on the left that says
 * what the product is, and the form on the right with one clear path through
 * it — title, message, fields, one primary action, then the way out at the
 * bottom. On narrow screens the panel gives way to a small brand row.
 *
 * The panel is always ink, in light mode too, so the brand reads the same.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The way out, centred under the form: "New here? Create an account". */
  footer?: ReactNode;
}) {
  return (
    <div className="pp-auth">
      <aside className="pp-auth-brand" aria-hidden>
        <div className="pp-auth-brand-glow" />
        <Flex vertical gap={28} className="pp-auth-brand-body">
          <Flex align="center" gap={12}>
            <img src="/icon.svg" alt="" width={44} height={44} />
            <span className="pp-label" style={{ color: dark.primary, fontWeight: 700, fontSize: 14 }}>
              Productivity
            </span>
          </Flex>
          <div>
            <h2 className="pp-auth-headline">Your day, in one place.</h2>
            <p className="pp-auth-pitch">Notes, tasks and reminders that keep working offline and sync to every device.</p>
          </div>
          <ul className="pp-auth-points">
            {["Capture a note in one keystroke", "Works offline, syncs when you're back", "Two-step verification built in"].map(
              (point) => (
                <li key={point}>
                  <span className="pp-auth-tick">
                    <CheckOutlined />
                  </span>
                  {point}
                </li>
              ),
            )}
          </ul>
        </Flex>
        <div className="pp-auth-brand-foot">
          <strong>Productivity</strong>
          <span>Personal workspace · Web and Android</span>
        </div>
      </aside>

      <main className="pp-auth-form">
        <div className="pp-auth-form-inner">
          <Flex align="center" gap={10} className="pp-auth-compact-brand">
            <img src="/icon.svg" alt="" width={32} height={32} />
            <span className="pp-label pp-label-brand" style={{ fontSize: 13 }}>
              Productivity
            </span>
          </Flex>
          <div className="pp-auth-heading">
            <Typography.Title level={1} style={{ margin: 0, fontSize: 34, lineHeight: 1.15 }}>
              {title}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 15 }}>
              {subtitle}
            </Typography.Text>
          </div>
          {children}
          {footer ? <div className="pp-auth-footer">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
