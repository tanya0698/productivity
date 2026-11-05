import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { editNote, newNote, noteDisplayTitle, noteText, sortNotes, type LocalNote } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { fonts, radii, usePalette } from "../../../theme";

type Note = LocalNote & { deletedAt: string | null };

const SAVE_DELAY_MS = 500;

/**
 * Notes, stored on the phone first. Every change is saved locally and synced in
 * the background, so the screen works the same with no connection.
 */
export default function NotesScreen() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const { records } = useLocalRecords<Note>("note");
  const notes = useMemo(() => sortNotes(records), [records]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = notes.find((n) => n.id === openId);

  const create = async () => {
    const note = newNote(runtime.newId(), new Date());
    await runtime.write("note", note);
    setOpenId(note.id);
  };

  if (open) {
    return (
      <ScreenFrame title="Note">
        <NoteEditor key={open.id} note={open} onClose={() => setOpenId(null)} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Notes">
      <Pressable
        accessibilityRole="button"
        onPress={() => void create()}
        style={[styles.primary, { backgroundColor: p.primary }]}
      >
        <Text weight="semiBold" style={{ color: p.onPrimary }}>
          New note
        </Text>
      </Pressable>
      {notes.length ? (
        notes.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="button"
            onPress={() => setOpenId(note.id)}
            style={[styles.row, { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Text weight="semiBold" numberOfLines={1}>
              {noteDisplayTitle(note)}
            </Text>
            <Text tone="secondary" style={{ fontSize: 12 }}>
              {new Date(note.updatedAt).toLocaleString()}
            </Text>
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="No notes yet"
          body="Notes are saved on this phone first and sync to the web app when you're online."
        />
      )}
    </ScreenFrame>
  );
}

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(noteText(note));
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ note, title, text });
  useEffect(() => {
    latest.current = { note, title, text };
  });

  // Show changes pulled from another device, unless they'd replace what's being typed.
  useEffect(() => {
    if (dirty.current) return;
    setTitle(note.title);
    setText(noteText(note));
  }, [note]);

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const current = latest.current;
    void runtime.write("note", editNote(current.note, { title: current.title, text: current.text }, new Date()));
  };

  const changed = () => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  // Don't lose the last keystrokes when leaving the editor.
  useEffect(() => save, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = () => {
    Alert.alert("Delete this note?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (timer.current) clearTimeout(timer.current);
          dirty.current = false;
          void runtime.write("note", latest.current.note, "delete").then(onClose);
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.editor, { backgroundColor: p.surface, borderColor: p.border }]}>
        <TextInput
          accessibilityLabel="Note title"
          placeholder="Title"
          placeholderTextColor={p.textMuted}
          maxLength={500}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            changed();
          }}
          onBlur={save}
          style={{ color: p.text, fontFamily: fonts.native.bold, fontSize: 18 }}
        />
        <TextInput
          accessibilityLabel="Note text"
          placeholder="Write something…"
          placeholderTextColor={p.textMuted}
          multiline
          textAlignVertical="top"
          value={text}
          onChangeText={(v) => {
            setText(v);
            changed();
          }}
          onBlur={save}
          style={{ color: p.text, fontFamily: fonts.native.regular, fontSize: 15, minHeight: 220 }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            save();
            onClose();
          }}
          style={[styles.primary, { flex: 1, backgroundColor: p.primary }]}
        >
          <Text weight="semiBold" style={{ color: p.onPrimary }}>
            Done
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmDelete}
          style={[styles.primary, { backgroundColor: p.errorSoft, paddingHorizontal: 18 }]}
        >
          <Text weight="semiBold" style={{ color: p.errorText }}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { alignItems: "center", justifyContent: "center", borderRadius: radii.md, paddingVertical: 12 },
  row: { borderWidth: 1, borderRadius: radii.md, padding: 14, gap: 2 },
  editor: { borderWidth: 1, borderRadius: radii.lg, padding: 14, gap: 8 },
});
