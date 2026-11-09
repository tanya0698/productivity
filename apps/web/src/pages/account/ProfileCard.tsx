import { useState } from "react";
import { Alert, App as AntApp, Avatar, Button, Card, Flex, Form, Input, Typography } from "antd";
import { MailOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { friendlyAuthError } from "@/pages/auth/authErrors";
import { displayName, initials } from "@/shared/auth/profile";

/**
 * Profile: the name shown in the app, and the sign-in email. A new email only
 * takes over once its confirmation link is clicked; until then the old one
 * keeps working (Supabase Auth's secure email change).
 */
export function ProfileCard() {
  const { client, session } = useAuth();
  const { message } = AntApp.useApp();
  const user = session?.user;
  const [nameBusy, setNameBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => user?.new_email ?? null);
  const name = displayName(user);

  const saveName = async ({ fullName }: { fullName: string }) => {
    setNameBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ data: { full_name: fullName.trim() } });
    setNameBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    void message.success("Name saved");
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

  return (
    <Card title="Profile" className="pp-card">
      <Flex vertical gap={20}>
        <Flex align="center" gap={14}>
          <Avatar size={52} className="pp-avatar">
            {initials(name || user?.email || "?")}
          </Avatar>
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

        <Form layout="vertical" requiredMark={false} initialValues={{ fullName: name }} onFinish={(v) => void saveName(v)} disabled={nameBusy}>
          <Form.Item name="fullName" label="Name" extra="Shown in the sidebar and in your greeting on Today." rules={[{ max: 80, message: "Keep it under 80 characters." }]}>
            <Input prefix={<UserOutlined />} placeholder="Your name" autoComplete="name" />
          </Form.Item>
          <Button htmlType="submit" loading={nameBusy}>
            Save name
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
