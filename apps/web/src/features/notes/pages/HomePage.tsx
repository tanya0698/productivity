import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Col, Flex, Input, List, Popconfirm, Row, Typography } from "antd";
import { useSearchParams } from "react-router-dom";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { editNote, newNote, noteDisplayTitle, noteText, sortNotes, type LocalNote } from "@productivity/domain";
import { ModulePage, ProjectSelect, ProjectTag, useLocalRecords, useProjects, useSyncRuntime, type Project } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";

const SAVE_DELAY_MS = 500;

/**
 * Notes, stored in this browser first. Every change is saved locally and synced
 * in the background, so the page works the same with no connection.
 */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const { records, loading } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const notes = useMemo(() => sortNotes(records), [records]);
  const { projects, byId } = useProjects();
  // Links from elsewhere: ?note=<id> opens a note; ?new=1&project=<id> starts one in a project.
  const [params] = useSearchParams();
  // A new note lives here, unsaved, until something is typed into it.
  const [draft, setDraft] = useState<(LocalNote & { deletedAt: string | null }) | null>(() =>
    params.get("new") ? newNote(runtime.newId(), new Date(), { projectId: params.get("project") }) : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => draft?.id ?? params.get("note"));
  // Opening a different ?note= while already on this page (from search) switches to it.
  const noteParam = params.get("note");
  const [seenParam, setSeenParam] = useState(noteParam);
  if (noteParam !== seenParam) {
    setSeenParam(noteParam);
    if (noteParam) setSelectedId(noteParam);
  }
  const stored = notes.find((n) => n.id === selectedId);
  const selected = stored ?? (draft && draft.id === selectedId ? draft : null);

  const create = () => {
    const note = newNote(runtime.newId(), new Date());
    setDraft(note);
    setSelectedId(note.id);
  };

  return (
    <ModulePage
      eyebrow="Capture"
      title="Notes"
      description="Saved on this device first, then synced to your other devices."
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={create}>
          New note
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={9}>
          <Card styles={{ body: { padding: notes.length ? 8 : 24 } }} loading={loading}>
            {notes.length ? (
              <List
                dataSource={notes}
                renderItem={(note) => (
                  <List.Item
                    onClick={() => setSelectedId(note.id)}
                    style={{
                      cursor: "pointer",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: note.id === selectedId ? "var(--pp-primary-soft)" : undefined,
                    }}
                  >
                    <List.Item.Meta
                      title={<Typography.Text strong={note.id === selectedId}>{noteDisplayTitle(note)}</Typography.Text>}
                      description={
                        <Flex gap={8} align="center" wrap>
                          {new Date(note.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          {note.projectId && byId.get(note.projectId) ? <ProjectTag title={byId.get(note.projectId)!.title} /> : null}
                        </Flex>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState text="No notes yet. Notes are saved on this device first and sync when you are online." />
            )}
          </Card>
        </Col>
        <Col xs={24} md={15}>
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              isDraft={!stored}
              projects={projects}
              onDeleted={() => {
                setSelectedId(null);
                setDraft(null);
              }}
            />
          ) : (
            <Card>
              <EmptyState text={notes.length ? "Choose a note to read or edit it." : "Your note will open here."} />
            </Card>
          )}
        </Col>
      </Row>
    </ModulePage>
  );
}

function NoteEditor({
  note,
  isDraft,
  projects,
  onDeleted,
}: {
  note: LocalNote & { deletedAt: string | null };
  projects: readonly Project[];
  /** Not saved yet: stays that way while it's empty, and discarding it writes nothing. */
  isDraft: boolean;
  onDeleted: () => void;
}) {
  const runtime = useSyncRuntime();
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(noteText(note));
  const [projectId, setProjectId] = useState(note.projectId);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ note, title, text, projectId, isDraft });
  useEffect(() => {
    latest.current = { note, title, text, projectId, isDraft };
  });

  // Show changes pulled from another device, unless they'd replace what's being typed.
  useEffect(() => {
    if (dirty.current) return;
    setTitle(note.title);
    setText(noteText(note));
    setProjectId(note.projectId);
  }, [note]);

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const { note: current, title: t, text: b, projectId: p, isDraft: draft } = latest.current;
    if (draft && !t.trim() && !b.trim()) return; // an empty new note is never saved
    void runtime.write("note", { ...editNote(current, { title: t, text: b }, new Date()), projectId: p });
  };

  const changed = () => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  // Don't lose the last keystrokes when switching notes or leaving the page.
  useEffect(() => save, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false;
    if (!latest.current.isDraft) await runtime.write("note", latest.current.note, "delete");
    onDeleted();
  };

  return (
    <Card
      extra={
        <Flex gap={4} align="center">
          <ProjectSelect
            projects={projects}
            value={projectId}
            aria-label="Note project"
            variant="borderless"
            style={{ minWidth: 150 }}
            onChange={(p) => {
              setProjectId(p);
              latest.current = { ...latest.current, projectId: p };
              dirty.current = true;
              save();
            }}
          />
          <Popconfirm title="Delete this note?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => void remove()}>
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete note" />
          </Popconfirm>
        </Flex>
      }
      title={
        <Input
          variant="borderless"
          placeholder="Title"
          aria-label="Note title"
          maxLength={500}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            changed();
          }}
          onBlur={save}
          style={{ fontWeight: 600, paddingInline: 0 }}
        />
      }
    >
      <Input.TextArea
        variant="borderless"
        placeholder="Write something…"
        aria-label="Note text"
        autoSize={{ minRows: 10 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          changed();
        }}
        onBlur={save}
        style={{ paddingInline: 0 }}
      />
    </Card>
  );
}
