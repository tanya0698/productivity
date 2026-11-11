import React, { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { noteDisplayTitle, sortNotes, type LocalNote } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { usePalette } from "../../../theme";

type Note = LocalNote & { deletedAt: string | null };
type Nav = { navigate: (name: string, params?: object) => void };

/** The last few notes touched; tap one to open it. */
export default function RecentNotesWidget() {
  const navigation = useNavigation<Nav>();
  const p = usePalette();
  const { records } = useLocalRecords<Note>("note");
  const recent = useMemo(
    () => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
    [records],
  );
  return (
    <>
      {recent.length ? (
        sortNotes(recent).map((n, i) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            onPress={() => navigation.navigate("notes", { note: n.id })}
            style={({ pressed }) => [styles.row, { borderColor: p.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>
              {noteDisplayTitle(n)}
            </Text>
            <Text tone="muted" style={{ fontSize: 12 }}>
              {new Date(n.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          No notes yet. Switch capture to Note above.
        </Text>
      )}
      <FootLink label="All notes" onPress={() => navigation.navigate("notes")} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
});
