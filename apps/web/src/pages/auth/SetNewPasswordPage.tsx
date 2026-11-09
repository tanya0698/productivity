import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { ArrowRightOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { AuthCard } from "./AuthCard";
import { friendlyAuthError } from "./authErrors";

/** Where a password-reset link lands: choose the new password before anything else opens. */
export default function SetNewPasswordPage() {
  const { client, finishRecovery, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async ({ password }: { password: string }) => {
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    finishRecovery();
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="You followed a reset link. Set a new password to finish signing in."
      footer={
        <>
          Changed your mind?{" "}
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => void signOut()}>
            Cancel and sign out
          </Button>
        </>
      }
    >
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Form layout="vertical" requiredMark={false} size="large" onFinish={(v) => void save(v)} disabled={busy}>
        <Form.Item
          name="password"
          label="New password"
          extra="At least 8 characters."
          rules={[{ required: true, min: 8, message: "Use at least 8 characters." }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Choose a password" autoComplete="new-password" autoFocus />
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
          <Input.Password prefix={<LockOutlined />} placeholder="Same password again" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy} icon={<ArrowRightOutlined />} iconPlacement="end">
          Save new password
        </Button>
      </Form>
    </AuthCard>
  );
}
