import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="This address doesn't match any page in the app."
      extra={
        <Button type="primary" onClick={() => navigate("/")}>
          Go to Today
        </Button>
      }
    />
  );
}
