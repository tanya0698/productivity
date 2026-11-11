import React, { useState } from "react";
import { Image, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import Text from "./Text";
import { avatarUrlOf, displayName, initials } from "../shared/auth/profile";
import { usePalette } from "../theme";

/** The profile picture from registration or the Profile card, or initials on teal. */
export default function Avatar({ user, size = 40, uri }: { user: User | null | undefined; size?: number; /** A local picture to show instead (before upload). */ uri?: string | null }) {
  const p = usePalette();
  const url = uri ?? avatarUrlOf(user);
  const [failed, setFailed] = useState<string | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (url && failed !== url) {
    return <Image source={{ uri: url }} style={[round, { backgroundColor: p.muted }]} onError={() => setFailed(url)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[round, { backgroundColor: p.primarySoft, alignItems: "center", justifyContent: "center" }]}>
      <Text weight="bold" style={{ color: p.primaryStrong, fontSize: size * 0.38 }}>
        {initials(displayName(user) || user?.email || "?")}
      </Text>
    </View>
  );
}
