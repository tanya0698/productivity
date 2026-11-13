import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "./Text";
import { radii, usePalette } from "../theme";

/**
 * The app's own confirm dialog, in place of Android's system alert: a card
 * over a dimmed screen, in the app's colours, with the consequence written
 * out and the destructive choice in red.
 *
 *   const { confirm, choose, notify } = useConfirm();
 *   if (await confirm({ title: "Delete this task?", body: task.title, confirmLabel: "Delete", destructive: true })) …
 *   const until = await choose({ title: "Snooze until", options: [{ label: "10 minutes", value: d1 }, …] });
 *   await notify({ title: "Couldn't export", body: message });
 *
 * With `action`, the dialog stays open showing a spinner while it runs, and
 * shows the error inside the dialog if it fails (used for signing out).
 */

type Tone = "default" | "destructive";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Run while the dialog stays open; a thrown error is shown in the dialog. */
  action?: () => Promise<void>;
}

export interface ChoiceOption<T> {
  label: string;
  value: T;
  destructive?: boolean;
}

interface Request {
  title: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  buttons: { label: string; kind: "primary" | "danger" | "plain"; value: unknown }[];
  action?: () => Promise<void>;
  resolve: (value: unknown) => void;
}

interface ConfirmApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  choose: <T>(o: { title: string; body?: string; options: ChoiceOption<T>[]; cancelLabel?: string }) => Promise<T | null>;
  notify: (o: { title: string; body?: string }) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const api = useContext(ConfirmContext);
  if (!api) throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  return api;
}

const CANCEL = Symbol("cancel");

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  const [req, setReq] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef<Request | null>(null);
  reqRef.current = req;

  const open = useCallback((r: Omit<Request, "resolve">) => {
    return new Promise<unknown>((resolve) => {
      // A second request while one is open answers the first with "cancel".
      reqRef.current?.resolve(CANCEL);
      setError(null);
      setBusy(false);
      setReq({ ...r, resolve });
    });
  }, []);

  const finish = (value: unknown) => {
    const r = reqRef.current;
    if (!r || busy) return;
    if (value !== CANCEL && r.action) {
      setBusy(true);
      setError(null);
      r.action()
        .then(() => {
          setBusy(false);
          setReq(null);
          r.resolve(value);
        })
        .catch((e: unknown) => {
          setBusy(false);
          setError(e instanceof Error ? e.message : String(e));
        });
      return;
    }
    setReq(null);
    r.resolve(value);
  };

  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: async (o) => {
        const v = await open({
          title: o.title,
          body: o.body,
          icon: o.icon ?? (o.destructive ? "trash-outline" : "help-circle-outline"),
          tone: o.destructive ? "destructive" : "default",
          action: o.action,
          buttons: [
            { label: o.cancelLabel ?? "Cancel", kind: "plain", value: CANCEL },
            { label: o.confirmLabel ?? "OK", kind: o.destructive ? "danger" : "primary", value: true },
          ],
        });
        return v === true;
      },
      choose: async <T,>(o: { title: string; body?: string; options: ChoiceOption<T>[]; cancelLabel?: string }) => {
        const v = await open({
          title: o.title,
          body: o.body,
          icon: "list-outline",
          tone: "default",
          buttons: [
            ...o.options.map((x) => ({ label: x.label, kind: (x.destructive ? "danger" : "plain") as "danger" | "plain", value: { picked: x.value } })),
            { label: o.cancelLabel ?? "Cancel", kind: "plain" as const, value: CANCEL },
          ],
        });
        return v === CANCEL ? null : (v as { picked: T }).picked;
      },
      notify: async (o) => {
        await open({ title: o.title, body: o.body, icon: "alert-circle-outline", tone: "default", buttons: [{ label: "OK", kind: "primary", value: true }] });
      },
    }),
    [open],
  );

  const stacked = (req?.buttons.length ?? 0) > 2;
  const accent = req?.tone === "destructive" ? p.error : p.primary;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal visible={!!req} transparent animationType="fade" statusBarTranslucent onRequestClose={() => finish(CANCEL)}>
        <Pressable style={[styles.backdrop, { backgroundColor: p.backdrop }]} onPress={() => finish(CANCEL)} accessibilityLabel="Close" />
        <View style={styles.center} pointerEvents="box-none">
          {req ? (
            <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { backgroundColor: p.elevated, borderColor: p.border }]}>
              <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
                <Ionicons name={req.icon ?? "help-circle-outline"} size={22} color={accent} />
              </View>
              <Text weight="bold" tone="heading" style={styles.title}>
                {req.title}
              </Text>
              {req.body ? (
                <Text tone="secondary" style={styles.body}>
                  {req.body}
                </Text>
              ) : null}
              {error ? <Text style={[styles.body, { color: p.errorText }]}>{error}</Text> : null}
              <View style={[styles.buttons, stacked && styles.stacked]}>
                {req.buttons.map((b) => {
                  const bg = b.kind === "primary" ? p.primary : b.kind === "danger" ? p.error : "transparent";
                  const fg = b.kind === "plain" ? p.text : b.kind === "danger" ? "#ffffff" : p.onPrimary;
                  const isConfirm = b.value !== CANCEL;
                  return (
                    <Pressable
                      key={b.label}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => finish(b.value)}
                      style={({ pressed }) => [
                        styles.button,
                        !stacked && { flex: 1 },
                        { backgroundColor: bg, borderColor: b.kind === "plain" ? p.borderStrong : bg, opacity: pressed ? 0.85 : busy && !isConfirm ? 0.5 : 1 },
                      ]}
                    >
                      {busy && isConfirm && req.action ? (
                        <ActivityIndicator color={fg} />
                      ) : (
                        <Text weight="semiBold" style={{ color: fg }}>
                          {b.label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderRadius: radii.lg, borderWidth: 1, padding: 20, gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  title: { fontSize: 18 },
  body: { fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 8 },
  stacked: { flexDirection: "column" },
  button: { minHeight: 46, borderRadius: radii.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
});
