import { forwardRef, type ReactNode } from "react";
import { Button, Tooltip, type ButtonProps } from "antd";

/**
 * A button that's only an icon: always with an antd tooltip, and the same
 * words as its accessible name, so nobody has to guess what it does.
 * Works inside Popconfirm and Dropdown (the ref and events pass through).
 */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "children" | "title"> & { tip: ReactNode; label?: string }>(
  function IconButton({ tip, label, ...props }, ref) {
    return (
      <Tooltip title={tip} mouseEnterDelay={0.25}>
        <Button ref={ref} type="text" aria-label={label ?? (typeof tip === "string" ? tip : undefined)} {...props} />
      </Tooltip>
    );
  },
);
