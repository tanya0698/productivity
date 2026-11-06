import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
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
    <AuthCard title="Choose a new password" subtitle="You followed a reset link. Set a new password to continue.">
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Form layout="vertical" requiredMark={false} onFinish={(v) => void save(v)} disabled={busy}>
        <Form.Item name="password" label="New password" rules={[{ required: true, min: 8, message: "Use at least 8 characters." }]}>
          <Input.Password size="large" autoComplete="new-password" autoFocus />
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
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={busy}>
          Save new password
        </Button>
      </Form>
      <Button type="link" style={{ padding: 0, alignSelf: "flex-start" }} onClick={() => void signOut()}>
        Cancel and sign out
      </Button>
    </AuthCard>
  );
}
