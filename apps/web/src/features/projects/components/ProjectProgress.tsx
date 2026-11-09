import type { ProjectProgress as Progress } from "@productivity/domain";

/** A thin teal bar with "3 of 5 done" beside it; the words carry the number, not the bar alone. */
export function ProjectProgress({ progress }: { progress: Progress }) {
  return (
    <div className="pp-progress">
      <div
        className="pp-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Tasks done"
      >
        <div className="pp-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="pp-progress-text pp-num">
        {progress.total ? `${progress.done} of ${progress.total} done` : "No tasks yet"}
      </span>
    </div>
  );
}
