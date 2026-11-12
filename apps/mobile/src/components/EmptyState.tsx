import React from "react";
import { View } from "react-native";
import Text from "./Text";
import { usePalette, radii } from "../theme";

/** A solid card explaining what will appear here and how to add the first item. */
export default function EmptyState({ title, body }: { title: string; body: string }) {
  const p = usePalette();
  return (
    <View
      style={{
        backgroundColor: p.surface,
        borderColor: p.cardBorder,
        borderWidth: 1,
        borderRadius: radii.lg,
        padding: 16,
        gap: 4,
      }}
    >
      <Text weight="semiBold">{title}</Text>
      <Text tone="secondary">{body}</Text>
    </View>
  );
}
