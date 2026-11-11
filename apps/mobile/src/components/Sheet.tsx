import React from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "./Text";
import { radii, usePalette } from "../theme";

/** A bottom sheet over a dimmed backdrop, for editors. Tap outside or Back to close. */
export default function Sheet({
  open,
  title,
  onClose,
  right,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} onPress={onClose} />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: p.borderStrong }]} />
          <View style={styles.head}>
            <Text label tone="brand">
              {title}
            </Text>
            {right}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radii.lg + 6,
    borderTopRightRadius: radii.lg + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10, opacity: 0.6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32, marginBottom: 6 },
});
