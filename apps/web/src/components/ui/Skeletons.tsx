import { Card, Col, Flex, Row } from "antd";

/**
 * Skeletons shaped like what's coming: tiles, rows, cards, a chart, a
 * calendar. Shown while data loads, or before this device's first sync, so
 * an empty screen never pretends there's nothing. A soft shimmer moves across
 * them (still blocks with reduced motion). Screen readers hear "Loading".
 */

/** One shimmering block. */
export function Bone({ w = "100%", h = 12, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span className="pp-bone" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />;
}

/** A label for assistive tech; the bones themselves are hidden from it. */
const Loading = ({ what }: { what: string }) => <span className="pp-sr-only">Loading {what}…</span>;

/** One entity card's outline: icon tile and two lines, a value with its pill, a ring. */
export function EntityCardBones({ ring = true }: { ring?: boolean }) {
  return (
    <div className="pp-entity pp-skel-tile">
      <Flex gap={12} align="center" style={{ marginBottom: 16 }}>
        <Bone w={40} h={40} r={10} />
        <Flex vertical gap={8} style={{ flex: 1 }}>
          <Bone w="55%" h={12} />
          <Bone w="35%" h={9} />
        </Flex>
      </Flex>
      <Flex justify="space-between" align="flex-end" style={{ marginTop: "auto" }}>
        <Flex vertical gap={8}>
          <Flex gap={8} align="center">
            <Bone w={64} h={22} r={6} />
            <Bone w={44} h={18} r={999} />
          </Flex>
          <Bone w={110} h={9} />
        </Flex>
        {ring ? <Bone w={44} h={44} r={999} /> : null}
      </Flex>
    </div>
  );
}

/** A row of stat cards. */
export function TileRowSkeleton({ count = 3, span = { xs: 12, md: 8 } }: { count?: number; span?: { xs?: number; sm?: number; md?: number; xl?: number } }) {
  return (
    <Row gutter={[16, 16]} aria-busy="true">
      <Loading what="figures" />
      {Array.from({ length: count }, (_, i) => (
        <Col key={i} {...span}>
          <EntityCardBones ring={i % 2 === 0} />
        </Col>
      ))}
    </Row>
  );
}

/** Rows like tasks, habits or reminders: a round check, a title and a meta line. */
export function RowsSkeleton({ rows = 4, check = true }: { rows?: number; check?: boolean }) {
  // Varied widths, the same every render, so it reads as text rather than bars.
  const widths = ["62%", "48%", "71%", "39%", "56%", "66%", "44%"];
  return (
    <div className="pp-skel-rows" aria-busy="true">
      <Loading what="items" />
      {Array.from({ length: rows }, (_, i) => (
        <Flex key={i} gap={12} align="center" className="pp-skel-row">
          {check ? <Bone w={20} h={20} r={999} /> : null}
          <Flex vertical gap={8} style={{ flex: 1 }}>
            <Bone w={widths[i % widths.length]} h={12} />
            <Bone w="22%" h={9} />
          </Flex>
        </Flex>
      ))}
    </div>
  );
}

/** A card with a title bar and rows inside. */
export function ListCardSkeleton({ rows = 4, check = true }: { rows?: number; check?: boolean }) {
  return (
    <Card className="pp-card" title={<Bone w={120} h={11} />}>
      <RowsSkeleton rows={rows} check={check} />
    </Card>
  );
}

/** Cards in a grid, like projects or goals. */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Row gutter={[16, 16]} aria-busy="true">
      <Loading what="cards" />
      {Array.from({ length: count }, (_, i) => (
        <Col key={i} xs={24} sm={12} xl={6}>
          <EntityCardBones />
        </Col>
      ))}
    </Row>
  );
}

/** A column chart's outline: a hairline grid and bars of fixed, varied heights. */
export function ChartSkeleton({ bars = 14, height = 180 }: { bars?: number; height?: number }) {
  const heights = [30, 55, 40, 70, 25, 60, 45, 80, 35, 50, 65, 20, 58, 42];
  return (
    <div className="pp-skel-chart" style={{ height }} aria-busy="true">
      <Loading what="chart" />
      {Array.from({ length: bars }, (_, i) => (
        <Bone key={i} w="100%" h={(heights[i % heights.length]! / 100) * height} r={4} style={{ borderRadius: "4px 4px 0 0" }} />
      ))}
    </div>
  );
}

/** A month-ish grid for the calendar. */
export function CalendarSkeleton({ cells = 35 }: { cells?: number }) {
  return (
    <div className="pp-skel-calendar" aria-busy="true">
      <Loading what="calendar" />
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="pp-skel-cell">
          <Bone w={18} h={10} />
          {i % 3 === 0 ? <Bone w="80%" h={12} r={4} /> : null}
          {i % 5 === 1 ? <Bone w="60%" h={12} r={4} /> : null}
        </div>
      ))}
    </div>
  );
}

/** A whole page arriving: heading, tiles and a list. The router shows this while a page's code loads. */
export function PageSkeleton() {
  return (
    <Flex vertical gap={20} aria-busy="true">
      <Loading what="page" />
      <Flex vertical gap={10}>
        <Bone w={70} h={10} />
        <Bone w={220} h={30} r={8} />
        <Bone w={360} h={12} style={{ maxWidth: "80%" }} />
      </Flex>
      <TileRowSkeleton />
      <ListCardSkeleton rows={5} />
    </Flex>
  );
}
