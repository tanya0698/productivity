import { useCallback, useEffect, useState } from "react";
import { Alert, App as AntApp, Button, Card, Col, Flex, Form, Input, Popconfirm, Row, Tag, Typography } from "antd";
import type { Factor } from "@supabase/supabase-js";
import { ModulePage } from "@/shared/page/ModulePage";
import { useAuth } from "@/shared/auth/AuthProvider";
import { friendlyAuthError } from "@/pages/auth/authErrors";
import { DataCard } from "./DataCard";
import { ProfileCard } from "./ProfileCard";
import { NotificationsCard } from "./NotificationsCard";

/** Account: profile, password, two-step verification, and your data (backup). */
export default function AccountPage() {
  const { session } = useAuth();
  return (
    <ModulePage eyebrow="Account" title="Account & data" description={`Signed in as ${session?.user.email ?? "unknown"}.`}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ProfileCard />
        </Col>
        <Col xs={24} lg={12}>
          <Flex vertical gap={16}>
            <ChangePassword />
            <TwoFactor />
            <NotificationsCard />
          </Flex>
        </Col>
        <Col xs={24}>
          <DataCard />
        </Col>
      </Row>
    </ModulePage>
  );
}

function ChangePassword() {
  const { client } = useAuth();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async ({ password }: { password: string }) => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    form.resetFields();
    void message.success("Password updated");
  };

  return (
    <Card title="Password" className="pp-card">
      {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => void save(v)} disabled={busy}>
        <Form.Item name="password" label="New password" rules={[{ required: true, min: 8, message: "Use at least 8 characters." }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Confirm new password"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Type the new password again." },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || value === getFieldValue("password") ? Promise.resolve() : Promise.reject(new Error("The passwords don't match.")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>
          Update password
        </Button>
      </Form>
    </Card>
  );
}

type Enrolment = { factorId: string; qr: string; secret: string };

function TwoFactor() {
  const { client, refreshAssurance } = useAuth();
  const { message } = AntApp.useApp();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFactors = useCallback(() => client.auth.mfa.listFactors(), [client]);
  const apply = ({ data, error: e }: Awaited<ReturnType<typeof fetchFactors>>) => {
    if (e) return setError(friendlyAuthError(e.message));
    setFactors(data.totp.filter((f) => f.status === "verified"));
  };
  const load = async () => apply(await fetchFactors());

  useEffect(() => {
    let cancelled = false;
    void fetchFactors().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFactors]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true);
    setError(null);
    // Clear any half-finished set-up first: Supabase refuses a second unverified factor with the same name.
    const { data: existing } = await client.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== "verified") await client.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: e } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async ({ code }: { code: string }) => {
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    setEnrolment(null);
    await refreshAssurance();
    await load();
    void message.success("Two-step verification is on");
  };

  const turnOff = async (factorId: string) => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    await refreshAssurance();
    await load();
    void message.success("Two-step verification is off");
  };

  const on = !!factors?.length;

  return (
    <Card
      title="Two-step verification"
      className="pp-card"
      extra={factors ? <Tag color={on ? "green" : "default"}>{on ? "On" : "Off"}</Tag> : null}
      loading={!factors}
    >
      {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}

      {on ? (
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">
            Signing in asks for a code from your authenticator app as well as your password.
          </Typography.Text>
          <Popconfirm
            title="Turn off two-step verification?"
            description="Your password alone will be enough to sign in."
            okText="Turn off"
            okButtonProps={{ danger: true }}
            onConfirm={() => void turnOff(factors![0]!.id)}
          >
            <Button danger loading={busy} style={{ alignSelf: "flex-start" }}>
              Turn off
            </Button>
          </Popconfirm>
        </Flex>
      ) : enrolment ? (
        <Flex vertical gap={12}>
          <Typography.Text>
            Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the code it shows.
          </Typography.Text>
          <img src={enrolment.qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Can't scan? Enter this key instead:{" "}
            <Typography.Text code copyable>
              {enrolment.secret}
            </Typography.Text>
          </Typography.Text>
          <Form layout="inline" onFinish={(v) => void confirm(v)} disabled={busy}>
            <Form.Item name="code" rules={[{ required: true, pattern: /^\s*\d{6}\s*$/, message: "6 digits" }]}>
              <Input placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Code" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              Turn on
            </Button>
          </Form>
          <Button type="link" style={{ padding: 0, alignSelf: "flex-start" }} onClick={() => setEnrolment(null)}>
            Cancel
          </Button>
        </Flex>
      ) : (
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">
            Add a code from an authenticator app to every sign-in, so a stolen password isn't enough.
          </Typography.Text>
          <Button type="primary" loading={busy} onClick={() => void start()} style={{ alignSelf: "flex-start" }}>
            Set up
          </Button>
        </Flex>
      )}
    </Card>
  );
}
