import { useState } from "react";
import { Alert, Button, Flex, Form, Input } from "antd";
import { useAuth } from "@/shared/auth/AuthProvider";
import { AuthCard } from "./AuthCard";
import { friendlyAuthError } from "./authErrors";

type Mode = "sign-in" | "sign-up" | "reset";

const COPY: Record<Mode, { title: string; button: string; switchText: string; switchTo: Mode }> = {
  "sign-in": { title: "Welcome back", button: "Sign in", switchText: "New here? Create an account", switchTo: "sign-up" },
  "sign-up": { title: "Create your account", button: "Create account", switchText: "Have an account? Sign in", switchTo: "sign-in" },
  reset: { title: "Reset your password", button: "Send reset link", switchText: "Back to sign in", switchTo: "sign-in" },
};

/** Sign in, create an account, or request a password-reset email. */
export default function SignInPage() {
  const { client } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = COPY[mode];

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async ({ email, password }: { email: string; password?: string }) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "sign-in") {
        const { error: e } = await client.auth.signInWithPassword({ email, password: password ?? "" });
        if (e) throw e;
      } else if (mode === "sign-up") {
        const { data, error: e } = await client.auth.signUp({
          email,
          password: password ?? "",
          options: { emailRedirectTo: window.location.origin },
        });
        if (e) throw e;
        if (!data.session) setNotice("Check your inbox: open the confirmation link, then sign in here.");
      } else {
        // The link brings you back here signed in for recovery, and the app asks for a new password.
        const { error: e } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (e) throw e;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={copy.title} subtitle="Your notes and tasks, on every device.">
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {notice ? <Alert type="success" showIcon message={notice} /> : null}

      <Form layout="vertical" requiredMark={false} onFinish={(v) => void submit(v)} disabled={busy}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Enter your email address." }]}>
          <Input size="large" autoComplete="email" autoFocus />
        </Form.Item>
        {mode !== "reset" ? (
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Enter your password." },
              ...(mode === "sign-up" ? [{ min: 8, message: "Use at least 8 characters." }] : []),
            ]}
          >
            <Input.Password size="large" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} />
          </Form.Item>
        ) : null}
        <Button type="primary" size="large" htmlType="submit" block loading={busy}>
          {copy.button}
        </Button>
      </Form>

      <Flex justify="space-between" wrap gap={8}>
        <Button type="link" style={{ padding: 0 }} onClick={() => switchTo(copy.switchTo)}>
          {copy.switchText}
        </Button>
        {mode === "sign-in" ? (
          <Button type="link" style={{ padding: 0 }} onClick={() => switchTo("reset")}>
            Forgot password?
          </Button>
        ) : null}
      </Flex>
    </AuthCard>
  );
}
