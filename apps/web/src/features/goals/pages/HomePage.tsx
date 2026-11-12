import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Row } from "antd";
import { FlagOutlined, PlusOutlined } from "@ant-design/icons";
import { EntityCard } from "@/components/ui/EntityCard";
import { goalCardStats, goalStatusLabel, localDate, newGoal, reviewDue } from "@productivity/domain";
import { ModulePage, formatDue, useNow, useProjects, useSyncRuntime, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { GoalEditor } from "../components/GoalEditor";
import { useGoals, type Goal } from "../components/useGoals";

/** Goals as cards: progress by milestones, target date, and whether a review is due. */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const now = useNow(60_000);
  const { goals, milestonesOf, loading } = useGoals();
  const ready = useDataReady(loading);
  const { projects } = useProjects();
  const [creating, setCreating] = useState<Goal | null>(null);
  const today = localDate(now);

  return (
    <ModulePage
      eyebrow="Grow"
      title="Goals"
      description="Outcomes you're working towards, broken into milestones, with projects and habits that move them on."
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(newGoal(runtime.newId(), new Date(), { title: "", reviewCadence: "monthly" }))}>
          New goal
        </Button>
      }
    >
      {!ready && !goals.length ? <CardGridSkeleton count={2} /> : null}
      {ready && !goals.length ? (
        <Card className="pp-card">
          <EmptyState text="No goals yet. Pick one outcome that matters this year, then break it into milestones." />
        </Card>
      ) : null}

      <Row gutter={[16, 16]}>
        {goals.map((g) => {
          const stats = goalCardStats(milestonesOf(g.id), today);
          const linked = projects.filter((p) => p.goalId === g.id).length;
          return (
            <Col key={g.id} xs={24} sm={12} xl={6}>
              <EntityCard
                icon={<FlagOutlined />}
                tone={g.status === "achieved" ? "success" : g.status === "dropped" ? "neutral" : reviewDue(g, now) ? "warning" : "accent"}
                title={g.title}
                subtitle={[
                  g.status !== "active" ? goalStatusLabel[g.status] : reviewDue(g, now) ? "Review due" : null,
                  g.targetDate ? `By ${formatDue(g.targetDate, today)}` : null,
                  linked ? `${linked} project${linked === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No target date"}
                value={stats.reached.now}
                trend={{ change: stats.reached.change, period: "vs the 30 days before" }}
                caption={`milestones in 30 days · ${stats.progress.total ? `${stats.progress.done} of ${stats.progress.total} done` : "none yet"}`}
                ring={{ percent: stats.progress.total ? stats.progress.percent : null, label: "Progress" }}
                onOpen={() => navigate(g.id)}
                ariaLabel={`Open goal: ${g.title}`}
              />
            </Col>
          );
        })}
      </Row>

      <GoalEditor
        goal={creating}
        isNew
        onClose={() => setCreating(null)}
        onSave={(g) => {
          void runtime.write("goal", g);
          void message.success("Goal added");
          setCreating(null);
          navigate(g.id);
        }}
      />
    </ModulePage>
  );
}
