import { Suspense, lazy, useMemo } from "react";
import { Card, Col, Empty, Input, Row, Skeleton } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getLiveModules } from "@/shared/modules/registry";
import { ModulePage } from "@/shared/page/ModulePage";

/**
 * Today — the landing page (plan §4.2). Quick capture on top, then the panels
 * each module contributes through `widgets` in its manifest.
 */
export default function TodayPage() {
  const widgets = useMemo(
    () =>
      getLiveModules().flatMap((m) =>
        (m.widgets ?? []).map((w) => ({ ...w, key: `${m.key}:${w.id}`, Component: lazy(w.load) })),
      ),
    [],
  );

  return (
    <ModulePage title="Today">
      <Input
        size="large"
        prefix={<PlusOutlined />}
        placeholder="Capture a task, note or reminder"
        aria-label="Quick capture"
        // Wired to the capture registry in Phase 2.
        disabled
      />
      {widgets.length ? (
        <Row gutter={[16, 16]}>
          {widgets.map(({ key, title, span, Component }) => (
            <Col key={key} xs={24} lg={span ?? 12}>
              <Card title={title}>
                <Suspense fallback={<Skeleton active />}>
                  <Component />
                </Suspense>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Empty description="Tasks due today, your next event and reminders will appear here." />
        </Card>
      )}
    </ModulePage>
  );
}
