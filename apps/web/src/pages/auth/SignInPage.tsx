import { useState } from "react";
import { Alert, Button, Checkbox, Flex, Form, Input } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "@/shared/auth/AuthProvider";
import { getRememberMe, setRememberMe } from "@/shared/auth/supabase";
import { AuthCard } from "./AuthCard";
import { AvatarPicker } from "@/components/ui/UserAvatar";
import { setPendingAvatar, uploadAvatar } from "@/shared/auth/avatar";
import { PHONE_PATTERN, profileMetadata } from "@/shared/auth/profile";
import { friendlyAuthError } from "./authErrors";

type Mode = "sign-in" | "sign-up" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; button: string }> = {
  "sign-in": { title: "Welcome back", subtitle: "Sign in to pick up where you left off.", button: "Sign in" },
  "sign-up": { title: "Create your account", subtitle: "Your notes and tasks, on every device.", button: "Create account" },
  reset: {
    title: "Reset your password",
    subtitle: "Enter your account's email and we'll send you a link to choose a new password.",
    button: "Send reset link",
  },
};

interface Values {
  email: string;
  password?: string;
  remember?: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Sign in, create an account, or request a password-reset email. One path
 * through the form: message, fields, options, one primary action, and the way
 * to the other mode at the bottom.
 */
export default function SignInPage() {
  const { client, confirmedEmail } = useAuth();
  const [form] = Form.useForm<Values>();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [busy, setBusy] = useState(false);
  // Registration only: a prepared picture (data URL), uploaded once the account exists.
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Arriving from a confirmation link: say so, and have the email ready so only the password is left.
  const [notice, setNotice] = useState<string | null>(
    confirmedEmail !== null ? "Your email is confirmed. Sign in with your password to continue." : null,
  );
  const prefilledEmail = confirmedEmail || undefined;
  const copy = COPY[mode];

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    form.setFields([{ name: "password", value: undefined, errors: [] }]);
  };

  const submit = async ({ email, password, remember, firstName, lastName, phone }: Values) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "sign-in") {
        setRememberMe(remember ?? true); // decides where the session is stored, so set it first
        const { error: e } = await client.auth.signInWithPassword({ email, password: password ?? "" });
        if (e) throw e;
      } else if (mode === "sign-up") {
        const { data, error: e } = await client.auth.signUp({
          email,
          password: password ?? "",
          options: {
            emailRedirectTo: window.location.origin,
            data: profileMetadata({ firstName: firstName ?? "", lastName: lastName ?? "", phone }),
          },
        });
        if (e) throw e;
        if (avatar) {
          if (data.session) {
            // Signed in straight away (no email confirmation): upload now.
            const url = await uploadAvatar(avatar, data.session.access_token).catch(() => null);
            if (url) await client.auth.updateUser({ data: { avatar_url: url } });
            else setPendingAvatar(email, avatar);
          } else {
            // The account only exists once confirmed; upload on first sign-in.
            setPendingAvatar(email, avatar);
          }
        }
        if (!data.session) {
          // Back to sign-in, where they'll land after confirming.
          switchTo("sign-in");
          setNotice(`We sent a confirmation link to ${email}. Open it, then sign in here.`);
        }
      } else {
        // The link brings you back here signed in for recovery, and the app asks for a new password.
        const { error: e } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (e) throw e;
        setNotice("If that email has an account, a reset link is on its way. Check your inbox.");
      }
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const footer =
    mode === "sign-in" ? (
      <>
        New here?{" "}
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => switchTo("sign-up")}>
          Create an account
        </Button>
      </>
    ) : mode === "sign-up" ? (
      <>
        Already have an account?{" "}
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => switchTo("sign-in")}>
          Sign in
        </Button>
      </>
    ) : (
      <>
        Remembered it?{" "}
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => switchTo("sign-in")}>
          Back to sign in
        </Button>
      </>
    );

  return (
    <AuthCard title={copy.title} subtitle={copy.subtitle} footer={footer}>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {notice ? <Alert type="success" showIcon title={notice} /> : null}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        size="large"
        initialValues={{ remember: getRememberMe(), email: prefilledEmail }}
        onFinish={(v) => void submit(v)}
        disabled={busy}
      >
        {mode === "sign-up" ? (
          <>
            <Form.Item label="Profile picture" style={{ marginBottom: 18 }}>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </Form.Item>
            <Flex gap={12}>
              <Form.Item
                name="firstName"
                label="First name"
                style={{ flex: 1 }}
                rules={[{ required: true, whitespace: true, message: "Enter your first name." }, { max: 60 }]}
              >
                <Input prefix={<UserOutlined />} autoComplete="given-name" autoFocus />
              </Form.Item>
              <Form.Item
                name="lastName"
                label="Last name"
                style={{ flex: 1 }}
                rules={[{ required: true, whitespace: true, message: "Enter your last name." }, { max: 60 }]}
              >
                <Input autoComplete="family-name" />
              </Form.Item>
            </Flex>
          </>
        ) : null}

        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Enter your email address." }]}>
          <Input prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" autoFocus={!prefilledEmail && mode !== "sign-up"} />
        </Form.Item>

        {mode === "sign-up" ? (
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
        ) : null}

        {mode !== "reset" ? (
          <Form.Item
            name="password"
            label="Password"
            extra={mode === "sign-up" ? "At least 8 characters." : undefined}
            rules={[
              { required: true, message: "Enter your password." },
              ...(mode === "sign-up" ? [{ min: 8, message: "Use at least 8 characters." }] : []),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={mode === "sign-up" ? "Choose a password" : "Your password"}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              autoFocus={!!prefilledEmail && mode === "sign-in"}
            />
          </Form.Item>
        ) : null}

        {mode === "sign-up" ? (
          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Type the password again." },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue("password") ? Promise.resolve() : Promise.reject(new Error("The passwords don't match.")),
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Same password again" autoComplete="new-password" />
          </Form.Item>
        ) : null}

        {mode === "sign-in" ? (
          <Flex justify="space-between" align="center" style={{ marginTop: -4, marginBottom: 20 }}>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Keep me signed in</Checkbox>
            </Form.Item>
            <Button type="link" size="middle" style={{ padding: 0, height: "auto", fontSize: 14 }} onClick={() => switchTo("reset")}>
              Forgot password?
            </Button>
          </Flex>
        ) : null}

        <Button type="primary" htmlType="submit" block loading={busy} icon={<ArrowRightOutlined />} iconPlacement="end">
          {copy.button}
        </Button>
      </Form>
    </AuthCard>
  );
}
