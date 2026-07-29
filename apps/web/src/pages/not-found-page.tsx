import { Link } from "react-router-dom";
import { EmptyState } from "@campflow/ui";

export function NotFoundPage() {
  return (
    <main className="centered-page">
      <EmptyState
        title="페이지를 찾을 수 없어요"
        action={
          <Link className="button button--primary" to="/">
            홈으로 돌아가기
          </Link>
        }
      >
        주소가 올바른지 확인해 주세요.
      </EmptyState>
    </main>
  );
}
