import { useState } from "react";
import { Alert, App as AntApp, Button, Card, Flex, Form, Input, Typography } from "antd";
import { MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { friendlyAuthError } from "@/pages/auth/authErrors";
import { PHONE_PATTERN, avatarUrlOf, displayName, firstNameOf, lastNameOf, phoneOf, profileMetadata } from "@/shared/auth/profile";
import { removeAvatar, uploadAvatar } from "@/shared/auth/avatar";
import { AvatarPicker, UserAvatar } from "@/components/ui/UserAvatar";

interface Details {
  firstName: string;
  lastName: string;
  phone?: string;
}

/**
 * Profile: picture, name and phone (Supabase Auth user metadata), and the
 * sign-in email. A new email only takes over once its confirmation link is
 * clicked; until then the old one keeps working (secure email change).
 */
export function ProfileCard() {
  const { client, session, getAccessToken } = useAuth();
  const { message } = AntApp.useApp();
  const user = session?.user;
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => user?.new_email ?? null);
  const name = displayName(user);

  const saveDetails = async ({ firstName, lastName, phone }: Details) => {
    setDetailsBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ data: profileMetadata({ firstName, lastName, phone }) });
    setDetailsBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    void message.success("Profile saved");
  };

  // The picture saves as soon as it's chosen or removed.
  const changeAvatar = async (dataUrl: string | null) => {
    setAvatarBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (dataUrl) {
        const url = await uploadAvatar(dataUrl, token);
        const { error: e } = await client.auth.updateUser({ data: { avatar_url: url } });
        if (e) throw e;
        void message.success("Picture updated");
      } else {
        await removeAvatar(token);
        const { error: e } = await client.auth.updateUser({ data: { avatar_url: null } });
        if (e) throw e;
        void message.success("Picture removed");
      }
    } catch (e) {
      setError(e instanceof Error ? friendlyAuthError(e.message) : String(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  const changeEmail = async ({ email }: { email: string }) => {
    const next = email.trim().toLowerCase();
    if (next === user?.email) return;
    setEmailBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ email: next }, { emailRedirectTo: window.location.origin });
    setEmailBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    setPendingEmail(next);
  };

  // The forms read their starting values once, so wait for the account.
  if (!user) return <Card title="Profile" className="pp-card" loading />;

  return (
    <Card title="Profile" className="pp-card">
      <Flex vertical gap={20}>
        <Flex align="center" gap={14}>
          <UserAvatar user={user} size={52} />
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text strong style={{ fontSize: 16 }} ellipsis>
              {name || "No name yet"}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis>
              {user?.email}
            </Typography.Text>
          </Flex>
        </Flex>

        {error ? <Alert type="error" showIcon title={error} /> : null}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Picture
          </Typography.Text>
          <AvatarPicker value={avatarUrlOf(user)} user={user} busy={avatarBusy} onChange={(v) => void changeAvatar(v)} />
        </div>

        <Form
          layout="vertical"
          requiredMark={false}
          initialValues={{ firstName: firstNameOf(user), lastName: lastNameOf(user), phone: phoneOf(user) }}
          onFinish={(v: Details) => void saveDetails(v)}
          disabled={detailsBusy}
        >
          <Flex gap={12} wrap>
            <Form.Item
              name="firstName"
              label="First name"
              style={{ flex: "1 1 180px" }}
              rules={[{ required: true, whitespace: true, message: "Enter your first name." }, { max: 60 }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="given-name" />
            </Form.Item>
            <Form.Item
              name="lastName"
              label="Last name"
              style={{ flex: "1 1 180px" }}
              rules={[{ required: true, whitespace: true, message: "Enter your last name." }, { max: 60 }]}
            >
              <Input autoComplete="family-name" />
            </Form.Item>
          </Flex>
          <Form.Item
            name="phone"
            label={
              <span>
                Phone number <span className="pp-optional">optional</span>
              </span>
            }
            rules={[{ pattern: PHONE_PATTERN, message: "Use digits, with + for the country code if you like." }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="+263 77 123 4567" autoComplete="tel" inputMode="tel" />
          </Form.Item>
          <Button htmlType="submit" loading={detailsBusy}>
            Save profile
          </Button>
        </Form>

        <Form layout="vertical" requiredMark={false} initialValues={{ email: user?.email }} onFinish={(v) => void changeEmail(v)} disabled={emailBusy}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Enter an email address." },
              { type: "email", message: "That doesn't look like an email address." },
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="email" />
          </Form.Item>
          {pendingEmail ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              title={`Check ${pendingEmail}`}
              description="We sent a confirmation link there. Your email changes once you click it; until then, keep signing in with your current one."
            />
          ) : null}
          <Button htmlType="submit" loading={emailBusy}>
            Change email
          </Button>
        </Form>
      </Flex>
    </Card>
  );
}
