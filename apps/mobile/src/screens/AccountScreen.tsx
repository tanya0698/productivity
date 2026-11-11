import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "../components/Avatar";
import AvatarActions from "../components/AvatarActions";
import { Button, Field, Input } from "../components/Field";
import { Card } from "../components/ListCard";
import ScreenFrame from "../components/ScreenFrame";
import TwoFactorCard from "../components/TwoFactorCard";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import { pickAvatar, removeAvatar, uploadAvatar, type AvatarSource } from "../shared/auth/avatar";
import { PHONE_PATTERN, avatarUrlOf, displayName, firstNameOf, lastNameOf, phoneOf, profileMetadata } from "../shared/auth/profile";
import { radii, usePalette } from "../theme";

const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

/** Supabase errors are terse; say what to do instead. */
function friendly(message: string): string {
  if (/fetch|network/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  if (/already.*registered|already been registered/i.test(message)) return "Another account already uses that email.";
  return message;
}

/**
 * Account: picture, name and phone (Supabase Auth user metadata, the same
 * fields the web writes), the sign-in email, and signing out. A new email
 * only takes over once its confirmation link is opened.
 */
export default function AccountScreen() {
  const { client, session, signOut, getAccessToken } = useAuth();
  const p = usePalette();
  const user = session?.user;

  const [firstName, setFirstName] = useState(() => firstNameOf(user));
  const [lastName, setLastName] = useState(() => lastNameOf(user));
  const [phone, setPhone] = useState(() => phoneOf(user));
  const [email, setEmail] = useState(user?.email ?? "");
  const [pendingEmail, setPendingEmail] = useState<string | null>(user?.new_email ?? null);
  const [busy, setBusy] = useState<"details" | "email" | "avatar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Another device may change the profile; follow it while nothing is being typed here.
  const userId = user?.id;
  useEffect(() => {
    setFirstName(firstNameOf(user));
    setLastName(lastNameOf(user));
    setPhone(phoneOf(user));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = firstName.trim() !== firstNameOf(user) || lastName.trim() !== lastNameOf(user) || phone.trim() !== phoneOf(user);
  const detailsError = !firstName.trim()
    ? "Enter your first name."
    : !lastName.trim()
      ? "Enter your last name."
      : phone.trim() && !PHONE_PATTERN.test(phone.trim())
        ? "Use digits for the phone number, with + for the country code if you like."
        : null;

  const saveDetails = async () => {
    if (detailsError) return setError(detailsError);
    setBusy("details");
    setError(null);
    const { error: e } = await client.auth.updateUser({ data: profileMetadata({ firstName, lastName, phone }) });
    setBusy(null);
    if (e) return setError(friendly(e.message));
    toast("Profile saved");
  };

  const changeAvatar = async (source: AvatarSource | null) => {
    setPicking(false);
    setError(null);
    try {
      // Let the sheet close before Android's picker opens over it.
      if (source) await new Promise((r) => setTimeout(r, 250));
      const picked = source ? await pickAvatar(source) : null;
      if (source && !picked) return; // cancelled
      setBusy("avatar");
      const token = await getAccessToken();
      if (picked) {
        const url = await uploadAvatar(picked.dataUrl, token);
        const { error: e } = await client.auth.updateUser({ data: { avatar_url: url } });
        if (e) throw e;
        toast("Picture updated");
      } else {
        await removeAvatar(token);
        const { error: e } = await client.auth.updateUser({ data: { avatar_url: null } });
        if (e) throw e;
        toast("Picture removed");
      }
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const changeEmail = async () => {
    const next = email.trim().toLowerCase();
    if (!next || next === user?.email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return setError("That doesn't look like an email address.");
    setBusy("email");
    setError(null);
    const { error: e } = await client.auth.updateUser({ email: next });
    setBusy(null);
    if (e) return setError(friendly(e.message));
    setPendingEmail(next);
  };

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "Anything not synced yet stays on this phone and syncs when you sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <ScreenFrame eyebrow="Settings" title="Account">
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={() => setPicking(true)} disabled={busy === "avatar"}>
          <Avatar user={user} size={92} />
          <View style={{ position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: p.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: p.page }}>
            {busy === "avatar" ? <ActivityIndicator size="small" color={p.onPrimary} /> : <Ionicons name="camera" size={15} color={p.onPrimary} />}
          </View>
        </Pressable>
        <Text weight="bold" tone="heading" style={{ fontSize: 20 }}>
          {displayName(user) || "No name yet"}
        </Text>
        <Text tone="secondary">{user?.email}</Text>
      </View>

      {error ? (
        <View style={{ backgroundColor: p.errorSoft, borderRadius: radii.md, padding: 12 }}>
          <Text style={{ color: p.errorText }}>{error}</Text>
        </View>
      ) : null}

      <Card title="Profile">
        <View style={{ gap: 12, paddingBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="First name">
                <Input accessibilityLabel="First name" value={firstName} onChangeText={setFirstName} maxLength={60} autoComplete="given-name" textContentType="givenName" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Last name">
                <Input accessibilityLabel="Last name" value={lastName} onChangeText={setLastName} maxLength={60} autoComplete="family-name" textContentType="familyName" />
              </Field>
            </View>
          </View>
          <Field label="Phone number (optional)">
            <Input accessibilityLabel="Phone number" value={phone} onChangeText={setPhone} placeholder="+263 77 123 4567" keyboardType="phone-pad" autoComplete="tel" />
          </Field>
          <Button kind={dirty ? "primary" : "plain"} label={busy === "details" ? "Saving…" : "Save profile"} onPress={() => void saveDetails()} disabled={!dirty || busy !== null} />
        </View>
      </Card>

      <Card title="Email">
        <View style={{ gap: 12, paddingBottom: 14 }}>
          <Input accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {pendingEmail ? (
            <Text tone="secondary" style={{ fontSize: 13 }}>
              {`We sent a confirmation link to ${pendingEmail}. Your email changes once you open it; until then, keep signing in with your current one.`}
            </Text>
          ) : null}
          <Button
            label={busy === "email" ? "Sending…" : "Change email"}
            onPress={() => void changeEmail()}
            disabled={busy !== null || !email.trim() || email.trim().toLowerCase() === user?.email}
          />
        </View>
      </Card>

      <ChangePassword />
      <TwoFactorCard />

      <Button kind="danger" label="Sign out" onPress={confirmSignOut} />

      <AvatarActions
        open={picking}
        canRemove={!!avatarUrlOf(user)}
        onClose={() => setPicking(false)}
        onPick={(s) => void changeAvatar(s)}
        onRemove={() => void changeAvatar(null)}
      />
    </ScreenFrame>
  );
}

/** A new password, typed twice. Same rules as the web: at least 8 characters. */
function ChangePassword() {
  const { client } = useAuth();
  const p = usePalette();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (confirm !== password) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    const { error: e } = await client.auth.updateUser({ password });
    setBusy(false);
    if (e) {
      return setError(
        /different from the old/i.test(e.message) ? "That's your current password. Choose a new one." : /fetch|network/i.test(e.message) ? "Couldn't reach the server. Check your connection and try again." : e.message,
      );
    }
    setPassword("");
    setConfirm("");
    toast("Password updated");
  };

  return (
    <Card title="Password">
      <View style={{ gap: 12, paddingBottom: 14 }}>
        <Field label="New password">
          <Input accessibilityLabel="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        </Field>
        <Field label="Confirm new password">
          <Input
            accessibilityLabel="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={() => void save()}
          />
        </Field>
        {error ? <Text style={{ color: p.errorText, fontSize: 13 }}>{error}</Text> : null}
        <Button kind={password && confirm ? "primary" : "plain"} label={busy ? "Updating…" : "Update password"} onPress={() => void save()} disabled={busy || !password || !confirm} />
      </View>
    </Card>
  );
}
