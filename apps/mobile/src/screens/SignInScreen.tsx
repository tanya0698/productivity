import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBackground from "../components/GlassBackground";
import ModeButton from "../components/ModeButton";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import { fonts, radii, usePalette } from "../theme";

type Mode = "sign-in" | "sign-up";

/** Supabase errors are terse; say what to do instead. Same wording as the web app. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link Supabase sent you, then sign in.";
  if (/already registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the sign-in service. Check your connection and try again.";
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

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
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
        const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      } else {
        const { data, error: e } = await client.auth.signUp({ email: email.trim(), password });
        if (e) throw e;
        if (!data.session) setNotice("Check your inbox: open the confirmation link, then sign in here.");
      }
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: p.surface, borderColor: p.borderStrong, color: p.text }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.page }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GlassBackground style={{ flex: 1, paddingTop: insets.top + 48, paddingHorizontal: 24 }}>
        <View style={{ position: "absolute", top: insets.top + 12, right: 20 }}>
          <ModeButton />
        </View>
        <Text label tone="brand">Creedence</Text>
        <Text weight="extraBold" tone="heading" style={styles.title}>
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </Text>
        <Text tone="secondary" style={{ marginBottom: 24 }}>
          Your notes and tasks, on every device.
        </Text>

        <View style={{ gap: 12 }}>
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
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            placeholderTextColor={p.textMuted}
            secureTextEntry
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            style={input}
          />
          {error ? <Text style={{ color: p.errorText }}>{error}</Text> : null}
          {notice ? <Text style={{ color: p.successText }}>{notice}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.button, { backgroundColor: p.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={p.onPrimary} />
            ) : (
              <Text weight="semiBold" style={{ color: p.onPrimary }}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={{ color: p.primary, textAlign: "center", paddingVertical: 8 }}>
              {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </GlassBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, letterSpacing: -0.6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: fonts.native.regular },
  button: { alignItems: "center", justifyContent: "center", borderRadius: radii.md, paddingVertical: 14, minHeight: 50 },
});
