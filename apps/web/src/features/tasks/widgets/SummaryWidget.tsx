import { EmptyState } from "@/components/ui/EmptyState";

/** The Today page's "Up next" panel. Lists the next tasks once the Tasks module stores them (Phase 2). */
export default function SummaryWidget() {
  return <EmptyState compact text="Nothing lined up. Tasks you add will appear here." />;
}
