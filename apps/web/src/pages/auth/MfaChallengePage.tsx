import { useEffect, useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { ArrowRightOutlined, SafetyOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { AuthCard } from "./AuthCard";
import { friendlyAuthError } from "./authErrors";

/**
 * The second step of signing in, for accounts with two-step verification on:
 * the 6-digit code from an authenticator app. Nothing else in the app opens
 * until it's verified, and the API refuses data to a session that skipped it.
 */
export default function MfaChallengePage() {
  const { client, refreshAssurance, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.auth.mfa.listFactors().then(({ data, error: e }) => {
      if (e) return setError(friendlyAuthError(e.message));
      const totp = data?.totp.find((f) => f.status === "verified");
      if (totp) setFactorId(totp.id);
      else setError("This account needs a second factor, but none is set up. Sign out and contact support.");
    });
  }, [client]);

  const verify = async ({ code }: { code: string }) => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (e) {
      setError(friendlyAuthError(e.message));
      setBusy(false);
      return;
    }
    await refreshAssurance();
  };

  return (
    <AuthCard
      title="Two-step verification"
      subtitle="Enter the 6-digit code from your authenticator app to finish signing in."
      footer={
        <>
          Not you?{" "}
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => void signOut()}>
            Use a different account
          </Button>
        </>
      }
    >
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Form layout="vertical" requiredMark={false} size="large" onFinish={(v) => void verify(v)} disabled={busy || !factorId}>
        <Form.Item
          name="code"
          label="Code"
          rules={[{ required: true, pattern: /^\s*\d{6}\s*$/, message: "Enter the 6 digits shown in the app." }]}
        >
          <Input
            prefix={<SafetyOutlined />}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            style={{ letterSpacing: "0.3em", fontFamily: "var(--pp-font-mono)" }}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy} icon={<ArrowRightOutlined />} iconPlacement="end">
          Verify
        </Button>
      </Form>
    </AuthCard>
  );
}
