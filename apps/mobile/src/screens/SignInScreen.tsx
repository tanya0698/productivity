import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import AvatarActions from "../components/AvatarActions";
import GlassBackground from "../components/GlassBackground";
import ModeButton from "../components/ModeButton";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import {
  pickAvatar,
  setPendingAvatar,
  uploadAvatar,
  type AvatarSource,
  type PickedAvatar,
} from "../shared/auth/avatar";
import { PHONE_PATTERN, profileMetadata } from "../shared/auth/profile";
import { fonts, radii, usePalette } from "../theme";

type Mode = "sign-in" | "sign-up" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; button: string }> =
  {
    "sign-in": {
      title: "Welcome back",
      subtitle: "Your notes and tasks, on every device.",
      button: "Sign in",
    },
    "sign-up": {
      title: "Create your account",
      subtitle: "Your notes and tasks, on every device.",
      button: "Create account",
    },
    reset: {
      title: "Reset your password",
      subtitle:
        "Enter your account's email and we'll send you a link to choose a new password.",
      button: "Send reset link",
    },
  };

/**
 * Where a reset link opens: the web app, which asks for the new password.
 * Set EXPO_PUBLIC_WEB_URL once the web app is hosted; without it, Supabase
 * uses the project's Site URL.
 */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

/** Supabase errors are terse; say what to do instead. Same wording as the web app. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message))
    return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(message))
    return "Confirm your email first: open the link Supabase sent you, then sign in.";
  if (/already registered/i.test(message))
    return "There's already an account with this email. Sign in instead.";
  if (/fetch|network/i.test(message))
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  return message;
}

export default function SignInScreen() {
  const { client } = useAuth();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [picking, setPicking] = useState(false);

  const choose = async (source: AvatarSource) => {
    setPicking(false);
    try {
      await new Promise((r) => setTimeout(r, 250)); // let the sheet close first
      const picked = await pickAvatar(source);
      if (picked) setAvatar(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
  };

  const submit = async () => {
    if (mode === "reset") {
      if (!email.trim()) return setError("Enter your email.");
      setBusy(true);
      setError(null);
      setNotice(null);
      const { error: e } = await client.auth.resetPasswordForEmail(
        email.trim(),
        WEB_URL ? { redirectTo: WEB_URL } : undefined,
      );
      setBusy(false);
      if (e) return setError(friendly(e.message));
      setNotice(
        "If that email has an account, a reset link is on its way. Open it to choose a new password, then sign in here.",
      );
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "sign-up" && (!firstName.trim() || !lastName.trim())) {
      setError("Enter your first and last name.");
      return;
    }
    if (
      mode === "sign-up" &&
      phone.trim() &&
      !PHONE_PATTERN.test(phone.trim())
    ) {
      setError(
        "Use digits for the phone number, with + for the country code if you like.",
      );
      return;
    }
    if (mode === "sign-up" && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "sign-in") {
        const { error: e } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e) throw e;
      } else {
        const { data, error: e } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { data: profileMetadata({ firstName, lastName, phone }) },
        });
        if (e) throw e;
        if (avatar) {
          if (data.session) {
            // Signed in straight away (no email confirmation): upload now.
            const url = await uploadAvatar(
              avatar.dataUrl,
              data.session.access_token,
            ).catch(() => null);
            if (url)
              await client.auth.updateUser({ data: { avatar_url: url } });
            else await setPendingAvatar(email, avatar.uri);
          } else {
            // The account only exists once confirmed; upload on first sign-in.
            await setPendingAvatar(email, avatar.uri);
          }
        }
        if (!data.session) {
          setMode("sign-in");
          setPassword("");
          setNotice(
            `We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`,
          );
        }
      }
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const input = [
    styles.input,
    { backgroundColor: p.surface, borderColor: p.borderStrong, color: p.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.page }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GlassBackground style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 48,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Text label tone="brand">
            Creedence
          </Text>
          <Text weight="extraBold" tone="heading" style={styles.title}>
            {COPY[mode].title}
          </Text>
          <Text tone="secondary" style={{ marginBottom: 24 }}>
            {COPY[mode].subtitle}
          </Text>

          <View style={{ gap: 12 }}>
            {mode === "sign-up" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    avatar
                      ? "Change profile picture"
                      : "Add a profile picture (optional)"
                  }
                  onPress={() => setPicking(true)}
                  style={styles.avatarRow}
                >
                  <Avatar user={null} uri={avatar?.uri ?? null} size={56} />
                  <Text tone="secondary">
                    {avatar ? "Change picture" : "Add a picture (optional)"}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    accessibilityLabel="First name"
                    placeholder="First name"
                    placeholderTextColor={p.textMuted}
                    autoComplete="given-name"
                    value={firstName}
                    onChangeText={setFirstName}
                    maxLength={60}
                    style={[input, { flex: 1 }]}
                  />
                  <TextInput
                    accessibilityLabel="Last name"
                    placeholder="Last name"
                    placeholderTextColor={p.textMuted}
                    autoComplete="family-name"
                    value={lastName}
                    onChangeText={setLastName}
                    maxLength={60}
                    style={[input, { flex: 1 }]}
                  />
                </View>
                <TextInput
                  accessibilityLabel="Phone number, optional"
                  placeholder="Phone number (optional)"
                  placeholderTextColor={p.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                  style={input}
                />
              </>
            ) : null}
            <TextInput
              accessibilityLabel="Email"
              placeholder="Email"
              placeholderTextColor={p.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={input}
            />
            {mode !== "reset" ? (
              <TextInput
                accessibilityLabel="Password"
                placeholder="Password"
                placeholderTextColor={p.textMuted}
                secureTextEntry
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                style={input}
              />
            ) : null}
            {mode === "sign-in" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => switchTo("reset")}
                hitSlop={8}
                style={{ alignSelf: "flex-end" }}
              >
                <Text tone="brand" style={{ fontSize: 13 }}>
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}
            {error ? <Text style={{ color: p.errorText }}>{error}</Text> : null}
            {notice ? (
              <Text style={{ color: p.successText }}>{notice}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submit()}
              style={[
                styles.button,
                { backgroundColor: p.primary, opacity: busy ? 0.7 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={p.onPrimary} />
              ) : (
                <Text weight="semiBold" style={{ color: p.onPrimary }}>
                  {COPY[mode].button}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                switchTo(mode === "sign-in" ? "sign-up" : "sign-in")
              }
            >
              <Text
                style={{
                  color: p.primary,
                  textAlign: "center",
                  paddingVertical: 8,
                }}
              >
                {mode === "sign-in"
                  ? "New here? Create an account"
                  : mode === "reset"
                    ? "Remembered it? Back to sign in"
                    : "Have an account? Sign in"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
        <View style={{ position: "absolute", top: insets.top + 12, right: 20 }}>
          <ModeButton />
        </View>
        <AvatarActions
          open={picking}
          canRemove={!!avatar}
          onClose={() => setPicking(false)}
          onPick={(s) => void choose(s)}
          onRemove={() => (setAvatar(null), setPicking(false))}
        />
      </GlassBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, letterSpacing: -0.6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.native.regular,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    paddingVertical: 14,
    minHeight: 50,
  },
});
