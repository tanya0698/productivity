import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Flex, Row, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { goalProgress, goalStatusLabel, localDate, newGoal, reviewDue } from "@productivity/domain";
import { ModulePage, formatDue, useNow, useProjects, useSyncRuntime } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { GoalEditor } from "../components/GoalEditor";
import { useGoals, type Goal } from "../components/useGoals";

/** Goals as cards: progress by milestones, target date, and whether a review is due. */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const now = useNow(60_000);
  const { goals, milestonesOf, loading } = useGoals();
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
      {!loading && !goals.length ? (
        <Card className="pp-card">
          <EmptyState text="No goals yet. Pick one outcome that matters this year, then break it into milestones." />
        </Card>
      ) : null}

      <Row gutter={[16, 16]}>
        {goals.map((g) => {
          const progress = goalProgress(milestonesOf(g.id));
          const linked = projects.filter((p) => p.goalId === g.id).length;
          return (
            <Col key={g.id} xs={24} md={12} xl={8}>
              <Card
                className={`pp-card pp-project-card${g.status === "active" ? "" : " pp-goal-finished"}`}
                hoverable
                role="link"
                tabIndex={0}
                aria-label={`Open goal: ${g.title}`}
                onClick={() => navigate(g.id)}
                onKeyDown={(e) => e.key === "Enter" && navigate(g.id)}
              >
                <Flex vertical gap={10}>
                  <Flex align="flex-start" gap={8}>
                    <Typography.Text strong style={{ fontSize: 16, flex: 1, minWidth: 0 }} ellipsis>
                      {g.title}
                    </Typography.Text>
                    {g.status !== "active" ? (
                      <span className={`pp-badge${g.status === "achieved" ? " pp-badge-success" : ""}`}>{goalStatusLabel[g.status]}</span>
                    ) : reviewDue(g, now) ? (
                      <span className="pp-badge pp-badge-warning">Review due</span>
                    ) : null}
                  </Flex>
                  {g.description ? (
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                      {g.description}
                    </Typography.Paragraph>
                  ) : null}
                  <div className="pp-progress">
                    <div className="pp-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Milestones done">
                      <div className="pp-progress-fill" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span className="pp-progress-text pp-num">
                      {progress.total ? `${progress.done} of ${progress.total} milestones` : "No milestones yet"}
                    </span>
                  </div>
                  <Flex gap={12} wrap>
                    {g.targetDate ? (
                      <span className="pp-label" style={{ fontSize: 10 }}>
                        By · {formatDue(g.targetDate, today)}
                      </span>
                    ) : null}
                    {linked ? (
                      <span className="pp-label" style={{ fontSize: 10 }}>
                        {linked} project{linked === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </Flex>
                </Flex>
              </Card>
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
