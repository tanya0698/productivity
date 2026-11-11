import React, { useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, StyleSheet, TextInput, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  byProject,
  editProject,
  groupTasks,
  isOpenProject,
  localDate,
  newProject,
  newTask,
  noteDisplayTitle,
  projectProgress,
  projectStatusLabel,
  sortNotes,
  unfile,
  type LocalNote,
  type ProjectStatus,
} from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import { Button, Chips } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { formatDue, useProjects, type Project } from "../../../shared/projects";
import { fonts, radii, usePalette } from "../../../theme";
import TaskEditor from "../../tasks/components/TaskEditor";
import TaskRow, { type Task } from "../../tasks/components/TaskRow";
import ProjectEditor from "../components/ProjectEditor";
import ProjectProgress from "../components/ProjectProgress";
import { go } from "../../../navigation/ref";

type Note = LocalNote & { deletedAt: string | null };
type View_ = "open" | "finished";
type Nav = { navigate: (name: string, params?: object) => void; setParams: (p: object) => void };

const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);
const statusOptions = (Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => ({ value: s, label: projectStatusLabel[s] }));
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Projects on the phone: every project with its progress, and one project's
 * tasks, notes and status, with the same rules as the web app.
 */
export default function ProjectsScreen() {
  const runtime = useSyncRuntime();
  const navigation = useNavigation<Nav>();
  const { projects, byId, loading } = useProjects();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Project | null>(null);

  // Opened on one project from elsewhere (Today's widget): navigate("projects", { project: id }).
  const route = useRoute<{ key: string; name: string; params?: { project?: string } }>();
  const requested = route.params?.project;
  useEffect(() => {
    if (!requested) return;
    setOpenId(requested);
    navigation.setParams({ project: undefined });
  }, [requested, navigation]);

  const close = () => setOpenId(null);
  // Android's back button goes from a project to the list, not out of Projects.
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [openId]);

  const editor = (
    <ProjectEditor
      project={creating}
      isNew
      onClose={() => setCreating(null)}
      onSave={(p) => {
        void runtime.write("project", p);
        setCreating(null);
        toast("Project created");
        setOpenId(p.id);
      }}
    />
  );

  if (openId) {
    const project = byId.get(openId);
    return project ? (
      <ProjectDetail key={project.id} project={project} onClose={close} />
    ) : (
      <ScreenFrame eyebrow="Project" title={loading ? "Project" : "Project not found"} onBack={close}>
        {loading ? null : <EmptyState title="Not here" body="This project was deleted, or hasn't reached this phone yet." />}
      </ScreenFrame>
    );
  }

  return (
    <>
      <ProjectList
        projects={projects}
        loading={loading}
        onOpen={setOpenId}
        onCreate={() => setCreating(newProject(runtime.newId(), new Date(), { title: "" }) as Project)}
      />
      {editor}
    </>
  );
}

function ProjectList({
  projects,
  loading,
  onOpen,
  onCreate,
}: {
  projects: Project[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const p = usePalette();
  const { records: tasks } = useLocalRecords<Task>("task");
  const [view, setView] = useState<View_>("open");
  const tasksByProject = useMemo(() => byProject(tasks, projects), [tasks, projects]);
  const open = projects.filter(isOpenProject);
  const finished = projects.filter((x) => !isOpenProject(x));
  const shown = view === "open" ? open : finished;
  const today = localDate(new Date());

  return (
    <ScreenFrame eyebrow="Plan" title="Projects">
      <Button kind="primary" label="New project" onPress={onCreate} />
      {finished.length ? (
        <Chips<View_>
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `Open · ${open.length}` },
            { value: "finished", label: `Done & archived · ${finished.length}` },
          ]}
        />
      ) : null}
      {!loading && !shown.length ? (
        <EmptyState
          title={view === "open" ? "No open projects" : "Nothing finished yet"}
          body={view === "open" ? "Start one for anything with more than a couple of steps: a trip, a move, a launch." : "Projects you finish or archive show up here."}
        />
      ) : null}
      {shown.map((x) => (
        <Pressable
          key={x.id}
          accessibilityRole="link"
          accessibilityLabel={`Open project: ${x.title}`}
          onPress={() => onOpen(x.id)}
          style={({ pressed }) => [styles.card, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={styles.cardHead}>
            <Text weight="semiBold" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>
              {x.title}
            </Text>
            {x.status !== "active" ? <StatusBadge status={x.status} /> : null}
          </View>
          {x.description ? (
            <Text tone="secondary" numberOfLines={2} style={{ fontSize: 13 }}>
              {x.description}
            </Text>
          ) : null}
          <ProjectProgress progress={projectProgress(tasksByProject.get(x.id) ?? [])} />
          {x.dueDate ? (
            <Text label style={{ fontSize: 10 }}>
              {`Target · ${formatDue(x.dueDate, today)}`}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScreenFrame>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const p = usePalette();
  const done = status === "done";
  return (
    <View style={[styles.badge, { backgroundColor: done ? p.successSoft : p.muted }]}>
      <Text style={{ fontSize: 11, color: done ? p.successText : p.textSecondary }}>{projectStatusLabel[status]}</Text>
    </View>
  );
}

/** One project: progress, status, its tasks (add, tick, edit) and its notes. */
function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const { records: allTasks } = useLocalRecords<Task>("task");
  const { records: allNotes } = useLocalRecords<Note>("note");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");

  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === project.id), [allTasks, project.id]);
  const notes = useMemo(() => sortNotes(allNotes.filter((n) => n.projectId === project.id)), [allNotes, project.id]);
  const now = new Date();
  const today = localDate(now);
  const groups = useMemo(() => groupTasks(tasks, new Date(), localDate(new Date())), [tasks]);
  const openTasks = [...groups.overdue, ...groups.today, ...groups.upcoming, ...groups.someday];
  const progress = projectProgress(tasks);
  const editingTask = tasks.find((t) => t.id === editingTaskId) ?? null;

  const setStatus = (status: ProjectStatus) => void runtime.write("project", editProject(project, { status }, new Date()));

  const addTask = () => {
    if (!title.trim()) return;
    void runtime.write("task", newTask(runtime.newId(), new Date(), { title, projectId: project.id }));
    setTitle("");
  };

  const removeTask = (task: Task) =>
    Alert.alert("Delete this task?", task.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runtime.write("task", task, "delete") },
    ]);

  const remove = () =>
    Alert.alert(
      "Delete this project?",
      tasks.length || notes.length ? `Its ${count(tasks.length, "task")} and ${count(notes.length, "note")} stay, without a project.` : project.title,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Its tasks and notes stay, filed under no project, on every device.
            const at = new Date();
            for (const t of tasks) await runtime.write("task", unfile(t, at));
            for (const n of notes) await runtime.write("note", unfile(n, at));
            await runtime.write("project", project, "delete");
            toast("Project deleted");
            onClose();
          },
        },
      ],
    );

  const row = (t: Task, n: number) => (
    <TaskRow key={t.id} task={t} now={now} today={today} first={n === 0} onPress={() => setEditingTaskId(t.id)} onLongPress={() => removeTask(t)} />
  );

  return (
    <ScreenFrame eyebrow="Project" title={project.title} onBack={onClose}>
      {project.description ? <Text tone="secondary">{project.description}</Text> : null}

      <View style={styles.tiles}>
        <View style={[styles.tile, { flex: 1.4, backgroundColor: p.surface, borderColor: p.border }]}>
          <Text label>Progress</Text>
          <Text weight="extraBold" style={{ fontSize: 26, color: p.primary }}>{`${progress.percent}%`}</Text>
          <ProjectProgress progress={progress} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text label>Open tasks</Text>
            <Text weight="bold" style={{ fontSize: 18, color: groups.overdue.length ? p.errorText : p.text }}>
              {String(openTasks.length)}
              {groups.overdue.length ? <Text style={{ fontSize: 12, color: p.errorText }}>{`  ${groups.overdue.length} overdue`}</Text> : null}
            </Text>
          </View>
          <View style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text label>Target</Text>
            <Text weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>
              {project.dueDate ? formatDue(project.dueDate, today) : "None"}
            </Text>
          </View>
        </View>
      </View>

      <Card title="Status" right={
        <View style={{ flexDirection: "row", gap: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit project" hitSlop={10} onPress={() => setEditingProject(true)}>
            <Ionicons name="create-outline" size={20} color={p.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete project" hitSlop={10} onPress={remove}>
            <Ionicons name="trash-outline" size={20} color={p.errorText} />
          </Pressable>
        </View>
      }>
        <View style={{ paddingBottom: 12 }}>
          <Chips value={project.status} options={statusOptions} onChange={setStatus} />
        </View>
      </Card>

      <Card title="Tasks" right={String(openTasks.length)}>
        <View style={[styles.add, { backgroundColor: p.page, borderColor: p.borderStrong }]}>
          <TextInput
            accessibilityLabel="New task in this project"
            placeholder="Add a task to this project"
            placeholderTextColor={p.textMuted}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={addTask}
            returnKeyType="done"
            style={[styles.input, { color: p.text }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add task" onPress={addTask} disabled={!title.trim()} hitSlop={8}>
            <Ionicons name="add-circle" size={26} color={p.primary} style={{ opacity: title.trim() ? 1 : 0.4 }} />
          </Pressable>
        </View>
        {openTasks.length ? (
          openTasks.map(row)
        ) : (
          <Text tone="secondary" style={{ paddingVertical: 10 }}>
            {tasks.length ? "Every task is done." : "No tasks yet. Add the first step above."}
          </Text>
        )}
        {groups.done.length ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setShowDone(!showDone)} style={styles.doneHead}>
              <Text label>{`Done · ${groups.done.length}`}</Text>
              <Ionicons name={showDone ? "chevron-up" : "chevron-down"} size={16} color={p.textMuted} />
            </Pressable>
            {showDone ? groups.done.map(row) : null}
          </>
        ) : null}
      </Card>

      <Card
        title="Notes"
        right={
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => go("notes", { newIn: project.id })}>
            <Text tone="brand" weight="semiBold" style={{ fontSize: 13 }}>
              + New note
            </Text>
          </Pressable>
        }
      >
        {notes.length ? (
          notes.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              onPress={() => go("notes", { note: n.id })}
              style={({ pressed }) => [styles.note, { borderColor: p.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text weight="medium" numberOfLines={1}>
                {noteDisplayTitle(n)}
              </Text>
              <Text tone="secondary" numberOfLines={1} style={{ fontSize: 13 }}>
                {n.bodyText.trim().split("\n").slice(n.title.trim() ? 0 : 1).join(" ") || "—"}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            No notes in this project. Meeting notes, research and ideas for it can live here.
          </Text>
        )}
      </Card>

      <TaskEditor task={editingTask} onClose={() => setEditingTaskId(null)} />
      <ProjectEditor
        project={editingProject ? project : null}
        onClose={() => setEditingProject(false)}
        onSave={(x) => {
          void runtime.write("project", x);
          setEditingProject(false);
          toast("Project saved");
        }}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 14, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { borderWidth: 1, borderRadius: radii.lg, padding: 12, gap: 4, justifyContent: "center" },
  add: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, marginBottom: 6 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.native.regular, paddingVertical: 10 },
  doneHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  note: { paddingVertical: 10, gap: 2 },
});
