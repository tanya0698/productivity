import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Sheet from "./Sheet";
import { Input } from "./Field";
import Text from "./Text";
import { usePalette } from "../theme";

/** Pick one item from a list in a bottom sheet, with a search box once the list is long. */
export default function PickSheet({
  open,
  title,
  items,
  empty,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  items: { id: string; title: string; detail?: string }[];
  empty: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const p = usePalette();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (needle ? items.filter((i) => i.title.toLowerCase().includes(needle)) : items).slice(0, 50);
  }, [items, q]);
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {items.length > 8 ? <Input accessibilityLabel="Search" value={q} onChangeText={setQ} placeholder="Search" /> : null}
      {shown.length ? (
        shown.map((i, n) => (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            onPress={() => {
              setQ("");
              onPick(i.id);
            }}
            style={({ pressed }) => [styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text numberOfLines={2}>{i.title}</Text>
            {i.detail ? (
              <Text tone="muted" style={{ fontSize: 12 }}>
                {i.detail}
              </Text>
            ) : null}
          </Pressable>
        ))
      ) : (
        <Text tone="secondary">{q ? "Nothing matches." : empty}</Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 11, gap: 2 },
});
