import { Empty } from "antd";

/** This module's panel on the Today page. Must show an empty state, never an error. */
export default function SummaryWidget() {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing for today." />;
}