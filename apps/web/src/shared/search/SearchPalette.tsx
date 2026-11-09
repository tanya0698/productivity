import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Modal } from "antd";
import { CheckSquareOutlined, FileTextOutlined, ProjectOutlined, SearchOutlined } from "@ant-design/icons";
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
import { useProjects } from "../projects/useProjects";
import type { Task } from "../tasks/TaskRow";
import { formatDue } from "../tasks/formatDue";

type Note = LocalNote & { deletedAt: string | null };

const kindIcon: Record<SearchKind, ReactNode> = {
  task: <CheckSquareOutlined />,
  note: <FileTextOutlined />,
  project: <ProjectOutlined />,
};
const kindName: Record<SearchKind, string> = { task: "Task", note: "Note", project: "Project" };

/** Where each kind of result opens. */
const resultPath =(kind: SearchKind, id: string) =>
  kind === "task" ? `/tasks?task=${id}` : kind === "note" ? `/notes?note=${id}` : `/projects/${id}`;

/**
 * Search everything on this device: tasks, notes and projects. Works offline,
 * since it reads local storage. Arrow keys move, Enter opens, Esc closes.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width={640}
      style={{ top: 72 }}
      styles={{ body: { padding: 0 } }}
      className="pp-search-modal"
      aria-label="Search"
    >
      {open ? <SearchBody onClose={onClose} /> : null}
    </Modal>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: notes } = useLocalRecords<Note>("note");
  const { projects, byId } = useProjects();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const docs = useMemo<SearchDoc[]>(
    () => [
      ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, body: t.description ?? "", updatedAt: t.updatedAt, finished: isDone(t) })),
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, title: noteDisplayTitle(n), body: n.bodyText, updatedAt: n.updatedAt })),
      ...projects.map((p) => ({ kind: "project" as const, id: p.id, title: p.title, body: p.description ?? "", updatedAt: p.updatedAt, finished: !isOpenProject(p) })),
    ],
    [tasks, notes, projects],
  );
  const hits = useMemo(() => search(docs, query, 30), [docs, query]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const today = localDate(new Date());

  const openHit = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onClose();
    navigate(resultPath(hit.doc.kind, hit.doc.id));
  };

  /** One line of context under the title. */
  const context = (hit: SearchHit): ReactNode => {
    if (hit.snippet) return <Highlight text={hit.snippet} ranges={hit.snippetRanges} />;
    if (hit.doc.kind === "task") {
      const t = taskById.get(hit.doc.id);
      const due = t?.dueDate ? formatDue(t.dueDate, today) : null;
      const bits = [
        t && isDone(t) ? "Done" : due ? `Due ${/^(Today|Tomorrow|Yesterday)$/.test(due) ? due.toLowerCase() : due}` : null,
        t?.projectId ? byId.get(t.projectId)?.title : null,
      ].filter(Boolean);
      return bits.join(" · ");
    }
    if (hit.doc.kind === "project") {
      const p = byId.get(hit.doc.id);
      return p ? projectStatusLabel[p.status] : "";
    }
    return "";
  };

  const current = Math.min(active, Math.max(hits.length - 1, 0));

  return (
    <div className="pp-search">
      <Input
        autoFocus
        size="large"
        variant="borderless"
        prefix={<SearchOutlined />}
        placeholder="Search tasks, notes and projects"
        aria-label="Search everything"
        aria-controls="pp-search-results"
        aria-activedescendant={hits.length ? `pp-hit-${current}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((current + 1) % Math.max(hits.length, 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((current - 1 + hits.length) % Math.max(hits.length, 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            openHit(hits[current]);
          }
        }}
        className="pp-search-input"
      />

      {query.trim() ? (
        hits.length ? (
          <ul id="pp-search-results" role="listbox" aria-label="Results" className="pp-search-results">
            {hits.map((hit, i) => (
              <li
                key={`${hit.doc.kind}:${hit.doc.id}`}
                id={`pp-hit-${i}`}
                role="option"
                aria-selected={i === current}
                className={`pp-search-hit${i === current ? " pp-search-hit-active" : ""}${hit.doc.finished ? " pp-search-hit-finished" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => openHit(hit)}
              >
                <span className="pp-search-icon" aria-hidden>
                  {kindIcon[hit.doc.kind]}
                </span>
                <span className="pp-search-text">
                  <span className="pp-search-title">
                    <Highlight text={hit.doc.title} ranges={hit.titleRanges} />
                  </span>
                  <span className="pp-search-context">{context(hit)}</span>
                </span>
                <span className="pp-label pp-search-kind">{kindName[hit.doc.kind]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pp-search-empty">Nothing matches “{query.trim()}”.</p>
        )
      ) : (
        <p className="pp-search-empty">
          Searches the {docs.length} {docs.length === 1 ? "item" : "items"} saved on this device, even offline.
        </p>
      )}

      <div className="pp-search-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
        <span><kbd>Enter</kbd> to open</span>
        <span><kbd>Esc</kbd> to close</span>
      </div>
    </div>
  );
}

/** Text with the matched parts wrapped in <mark>. */
function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={i} className="pp-mark">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
