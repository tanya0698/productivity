import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, ToastAndroid, View } from "react-native";
import type { Factor } from "@supabase/supabase-js";
import { useAuth } from "../shared/auth/AuthProvider";
import { radii, fonts, usePalette } from "../theme";
import { Button, Input } from "./Field";
import { Card } from "./ListCard";
import Text from "./Text";

type Enrolment = { factorId: string; secret: string; uri: string };

const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);
const friendly = (m: string) =>
  /invalid.*(code|totp)|code.*invalid/i.test(m)
    ? "That code didn't match. Check the app's current code and try again."
    : /fetch|network/i.test(m)
      ? "Couldn't reach the sign-in service. Check your connection and try again."
      : m;

/**
 * Two-step verification with an authenticator app (Supabase TOTP), the same
 * as on the web. On the phone there's no QR to scan, so the key opens straight
 * in the authenticator app (otpauth link), or can be typed in by hand.
 */
export default function TwoFactorCard() {
  const { client, refreshAssurance } = useAuth();
  const p = usePalette();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await client.auth.mfa.listFactors();
    if (e) return setError(friendly(e.message));
    setFactors(data.totp.filter((f) => f.status === "verified"));
  }, [client]);
  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setError(null);
    // Clear any half-finished set-up first: Supabase refuses a second unverified factor with the same name.
    const { data: existing } = await client.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status !== "verified") await client.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    setBusy(false);
    if (e) return setError(friendly(e.message));
    setCode("");
    setEnrolment({ factorId: data.id, secret: data.totp.secret, uri: data.totp.uri });
  };

  const openInApp = async () => {
    if (!enrolment) return;
    try {
      await Linking.openURL(enrolment.uri);
    } catch {
      setError("No authenticator app picked up the link. Install one (Google Authenticator, Microsoft Authenticator…), or type the key in by hand.");
    }
  };

  const confirm = async () => {
    if (!enrolment) return;
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from the app.");
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
    setBusy(false);
    if (e) return setError(friendly(e.message));
    setEnrolment(null);
    await refreshAssurance();
    await load();
    toast("Two-step verification is on");
  };

  const turnOff = (factorId: string) =>
    Alert.alert("Turn off two-step verification?", "Your password alone will be enough to sign in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setError(null);
          const { error: e } = await client.auth.mfa.unenroll({ factorId });
          setBusy(false);
          if (e) return setError(friendly(e.message));
          await refreshAssurance();
          await load();
          toast("Two-step verification is off");
        },
      },
    ]);

  const on = !!factors?.length;
  const badge = factors ? (
    <View style={{ borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: on ? p.successSoft : p.muted }}>
      <Text style={{ fontSize: 11, color: on ? p.successText : p.textSecondary }}>{on ? "On" : "Off"}</Text>
    </View>
  ) : undefined;

  return (
    <Card title="Two-step verification" right={badge}>
      <View style={{ gap: 12, paddingBottom: 14 }}>
        {error ? <Text style={{ color: p.errorText, fontSize: 13 }}>{error}</Text> : null}
        {!factors ? (
          <ActivityIndicator color={p.primary} />
        ) : on ? (
          <>
            <Text tone="secondary">Signing in asks for a code from your authenticator app as well as your password.</Text>
            <Button kind="danger" label={busy ? "Turning off…" : "Turn off"} onPress={() => turnOff(factors[0]!.id)} disabled={busy} />
          </>
        ) : enrolment ? (
          <>
            <Text>1. Add Creedence to an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…):</Text>
            <Button kind="primary" label="Open in authenticator app" onPress={() => void openInApp()} />
            <Text tone="secondary" style={{ fontSize: 12 }}>
              Or add it by hand with this key (press and hold to copy):
            </Text>
            <Text selectable style={{ fontFamily: fonts.native.mono, fontSize: 15, letterSpacing: 1, backgroundColor: p.muted, padding: 10, borderRadius: radii.sm }}>
              {enrolment.secret.replace(/(.{4})/g, "$1 ").trim()}
            </Text>
            <Text>2. Enter the 6-digit code the app shows:</Text>
            <Input
              accessibilityLabel="Code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={() => void confirm()}
            />
            <Button kind="primary" label={busy ? "Checking…" : "Turn on"} onPress={() => void confirm()} disabled={busy || code.length !== 6} />
            <Button label="Cancel" onPress={() => setEnrolment(null)} />
          </>
        ) : (
          <>
            <Text tone="secondary">Add a code from an authenticator app to every sign-in, so a stolen password isn't enough.</Text>
            <Button kind="primary" label={busy ? "Starting…" : "Set up"} onPress={() => void start()} disabled={busy} />
          </>
        )}
      </View>
    </Card>
  );
}
