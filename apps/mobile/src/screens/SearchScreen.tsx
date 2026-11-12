import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  isDone,
  isOpenProject,
  localDate,
  noteDisplayTitle,
  projectStatusLabel,
  search,
  type LocalNote,
  type SearchDoc,
  type SearchHit,
  type SearchKind,
} from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { Card } from "../components/ListCard";
import ScreenFrame from "../components/ScreenFrame";
import Text from "../components/Text";
import { go } from "../navigation/ref";
import { formatDue, useProjects } from "../shared/projects";
import { fonts, radii, usePalette } from "../theme";
import type { Task } from "../features/tasks/components/TaskRow";

type Note = LocalNote & { deletedAt: string | null };

const kindIcon: Record<SearchKind, keyof typeof Ionicons.glyphMap> = { task: "checkbox-outline", note: "document-text-outline", project: "folder-open-outline" };
const kindName: Record<SearchKind, string> = { task: "Task", note: "Note", project: "Project" };

/** Where each kind of result opens. */
const openResult = (kind: SearchKind, id: string) =>
  kind === "task" ? go("tasks", { task: id }) : kind === "note" ? go("notes", { note: id }) : go("projects", { project: id });

/**
 * Search everything on this phone: tasks, notes and projects. Works offline,
 * since it reads the local database; the ranking is the web's (shared domain).
 */
export default function SearchScreen() {
  const p = usePalette();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: notes } = useLocalRecords<Note>("note");
  const { projects, byId } = useProjects();
  const [query, setQuery] = useState("");

  const docs = useMemo<SearchDoc[]>(
    () => [
      ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, body: t.description ?? "", updatedAt: t.updatedAt, finished: isDone(t) })),
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, title: noteDisplayTitle(n), body: n.bodyText, updatedAt: n.updatedAt })),
      ...projects.map((x) => ({ kind: "project" as const, id: x.id, title: x.title, body: x.description ?? "", updatedAt: x.updatedAt, finished: !isOpenProject(x) })),
    ],
    [tasks, notes, projects],
  );
  const hits = useMemo(() => search(docs, query, 30), [docs, query]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const today = localDate(new Date());

  /** One line of context under the title. */
  const context = (hit: SearchHit): React.ReactNode => {
    if (hit.snippet) return <Highlight text={hit.snippet} ranges={hit.snippetRanges} />;
    if (hit.doc.kind === "task") {
      const t = taskById.get(hit.doc.id);
      const due = t?.dueDate ? formatDue(t.dueDate, today) : null;
      return [
        t && isDone(t) ? "Done" : due ? `Due ${/^(Today|Tomorrow|Yesterday)$/.test(due) ? due.toLowerCase() : due}` : null,
        t?.projectId ? byId.get(t.projectId)?.title : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (hit.doc.kind === "project") {
      const x = byId.get(hit.doc.id);
      return x ? projectStatusLabel[x.status] : "";
    }
    return "";
  };

  const open = (hit: SearchHit | undefined) => {
    if (!hit) return;
    Keyboard.dismiss();
    openResult(hit.doc.kind, hit.doc.id);
  };

  return (
    <ScreenFrame
      eyebrow="Find"
      title="Search"
      searchable={false}
      capture={
        <View style={styles.field}>
          <Ionicons name="search" size={18} color={p.textSecondary} />
          <TextInput
            autoFocus
            accessibilityLabel="Search everything"
            placeholder="Tasks, notes and projects"
            placeholderTextColor={p.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => open(hits[0])}
            autoCorrect={false}
            style={[styles.input, { color: p.text }]}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={p.textMuted} />
            </Pressable>
          ) : null}
        </View>
      }
    >
      {query.trim() ? (
        hits.length ? (
          <Card title="Results" right={String(hits.length)}>
            {hits.map((hit, i) => (
              <Pressable
                key={`${hit.doc.kind}:${hit.doc.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${kindName[hit.doc.kind]}: ${hit.doc.title}`}
                onPress={() => open(hit)}
                style={({ pressed }) => [
                  styles.hit,
                  { borderColor: p.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : hit.doc.finished ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
                  <Ionicons name={kindIcon[hit.doc.kind]} size={17} color={p.primaryStrong} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="medium" numberOfLines={1}>
                    <Highlight text={hit.doc.title} ranges={hit.titleRanges} />
                  </Text>
                  <Text tone="secondary" numberOfLines={2} style={{ fontSize: 12 }}>
                    {context(hit)}
                  </Text>
                </View>
                <Text label style={{ fontSize: 9 }}>
                  {kindName[hit.doc.kind]}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Text tone="secondary" style={styles.empty}>{`Nothing matches “${query.trim()}”.`}</Text>
        )
      ) : (
        <Text tone="secondary" style={styles.empty}>
          {`Searches the ${docs.length} ${docs.length === 1 ? "item" : "items"} saved on this phone, even offline.`}
        </Text>
      )}
    </ScreenFrame>
  );
}

/** Text with the matched parts highlighted (bold on a soft teal), so it isn't colour alone. */
function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const p = usePalette();
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <Text key={i} weight="bold" style={{ backgroundColor: p.primarySoft, color: p.primaryStrong }}>
        {text.slice(s, e)}
      </Text>,
    );
    at = e;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, fontSize: 16, fontFamily: fonts.native.regular, paddingVertical: 4 },
  hit: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  empty: { textAlign: "center", paddingVertical: 24, paddingHorizontal: 12 },
});
