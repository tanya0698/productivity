import { useState } from "react";
import { Avatar, Button, Flex, Typography } from "antd";
import { CameraOutlined, DeleteOutlined } from "@ant-design/icons";
import type { User } from "@supabase/supabase-js";
import { avatarUrlOf, displayName, initials } from "@/shared/auth/profile";
import { prepareAvatar } from "@/shared/auth/avatar";

/** The person's picture, or their initials on the brand gradient. */
export function UserAvatar({ user, size = 32, src }: { user: Pick<User, "user_metadata" | "email"> | null | undefined; size?: number; src?: string | null }) {
  const url = src === undefined ? avatarUrlOf(user) : src;
  const name = displayName(user) || user?.email || "?";
  return (
    <Avatar size={size} src={url ?? undefined} className="pp-avatar" alt={url ? `${name}'s picture` : undefined}>
      {initials(name)}
    </Avatar>
  );
}

/**
 * Choose, preview and remove a profile picture. It hands back a prepared
 * (resized) data URL, or null for "none"; the caller decides when to upload.
 */
export function AvatarPicker({
  value,
  onChange,
  user,
  busy = false,
}: {
  /** A data URL or an uploaded URL, or null. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  user?: Pick<User, "user_metadata" | "email"> | null;
  busy?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const choose = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReading(true);
    prepareAvatar(file)
      .then(onChange)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReading(false));
  };

  return (
    <Flex align="center" gap={14}>
      <UserAvatar user={user} size={64} src={value} />
      <Flex vertical gap={6}>
        <Flex gap={8} wrap>
          <Button icon={<CameraOutlined />} loading={reading || busy} onClick={() => document.getElementById("pp-avatar-file")?.click()}>
            {value ? "Change picture" : "Add a picture"}
          </Button>
          {value ? (
            <Button icon={<DeleteOutlined />} disabled={busy} onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
        </Flex>
        <Typography.Text type={error ? "danger" : "secondary"} style={{ fontSize: 12 }}>
          {error ?? "Optional. A square crop of the middle is used."}
        </Typography.Text>
      </Flex>
      <input
        id="pp-avatar-file"
        type="file"
        accept="image/*"
        hidden
        aria-label="Profile picture"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </Flex>
  );
}
