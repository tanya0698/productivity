import { CheckOutlined } from "@ant-design/icons";

/**
 * A quiet empty state: the teal tick-in-a-circle from the portfolio's feature
 * lists and one line of slate text. Used instead of antd's inbox illustration.
 */
export function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`pp-empty${compact ? " pp-empty-compact" : ""}`}>
      <span className="pp-tick" aria-hidden>
        <CheckOutlined />
      </span>
      <span>{text}</span>
    </div>
  );
}
