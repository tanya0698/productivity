import type { ReactNode } from "react";
import { Flex, Typography } from "antd";
import { APP_NAME, brandImages } from "@/shared/brand";
import { AuthScene, type AuthSceneVariant } from "./AuthScene";
import { ColorModeToggle } from "@/components/ui/ColorModeToggle";

/**
 * The layout every signed-out and in-between screen uses (sign in, create
 * account, reset, code, new password): an illustrated brand panel on the
 * left that makes one statement for the screen (AuthScene), and the form on the right with one clear path through
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
  scene = "sign-in",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The way out, centred under the form: "New here? Create an account". */
  footer?: ReactNode;
  /** Which statement the illustrated panel makes. */
  scene?: AuthSceneVariant;
}) {
  return (
    <div className="pp-auth">
      <aside className="pp-auth-brand" aria-hidden>
        <AuthScene variant={scene} />
      </aside>

      <main className="pp-auth-form">
        <div className="pp-auth-mode">
          <ColorModeToggle />
        </div>
        <div className="pp-auth-form-inner">
          <Flex align="center" gap={10} className="pp-auth-compact-brand">
            <img src={brandImages.mark} alt="" width={32} height={32} />
            <span className="pp-label pp-label-brand" style={{ fontSize: 13 }}>
              {APP_NAME}
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
