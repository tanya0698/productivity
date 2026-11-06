import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBackground from "../components/GlassBackground";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import { fonts, radii, usePalette } from "../theme";

/** The second step of signing in, for accounts with two-step verification on. */
export default function MfaChallengeScreen() {
  const { client, refreshAssurance, signOut } = useAuth();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.auth.mfa.listFactors().then(({ data, error: e }) => {
      if (e) return setError(e.message);
      const totp = data?.totp.find((f) => f.status === "verified");
      if (totp) setFactorId(totp.id);
      else setError("This account needs a second factor, but none is set up.");
    });
  }, [client]);

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6 digits shown in your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (e) {
      setError(/invalid|expired/i.test(e.message) ? "That code didn't work. Enter the current one." : e.message);
      setBusy(false);
      return;
    }
    await refreshAssurance();
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.page }}>
      <GlassBackground style={{ flex: 1, paddingTop: insets.top + 48, paddingHorizontal: 24, gap: 12 }}>
        <Text label tone="brand">Productivity</Text>
        <Text weight="extraBold" tone="heading" style={styles.title}>
          Two-step verification
        </Text>
        <Text tone="secondary">Enter the 6-digit code from your authenticator app.</Text>
        <TextInput
          accessibilityLabel="Code"
          placeholder="123456"
          placeholderTextColor={p.textMuted}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => void verify()}
          style={[styles.input, { backgroundColor: p.surface, borderColor: p.borderStrong, color: p.text }]}
        />
        {error ? <Text style={{ color: p.errorText }}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void verify()}
          style={[styles.button, { backgroundColor: p.primary, opacity: busy ? 0.7 : 1 }]}
        >
          {busy ? <ActivityIndicator color={p.onPrimary} /> : <Text weight="semiBold" style={{ color: p.onPrimary }}>Verify</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void signOut()}>
          <Text style={{ color: p.primary, textAlign: "center", paddingVertical: 8 }}>Use a different account</Text>
        </Pressable>
      </GlassBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, letterSpacing: -0.6 },
  input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, letterSpacing: 6, fontFamily: fonts.native.mono },
  button: { alignItems: "center", justifyContent: "center", borderRadius: radii.md, paddingVertical: 14, minHeight: 50 },
});
