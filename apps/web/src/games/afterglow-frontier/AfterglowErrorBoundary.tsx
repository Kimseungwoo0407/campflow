import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

const STORAGE_PREFIX = "campflow:afterglow-frontier:";

export class AfterglowErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The recovery screen keeps a broken local snapshot from blanking the whole site.
  }

  private recover = (): void => {
    try {
      const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      ).filter((key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX)));
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // A reload still recovers transient chunk and browser storage errors.
    }
    window.location.reload();
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page page--narrow">
        <section className="card stack-form" role="alert">
          <span className="eyebrow">잔광전선 복구 모드</span>
          <h1>게임 데이터를 불러오지 못했습니다</h1>
          <p>
            이전 버전의 브라우저 저장 데이터가 충돌했을 수 있습니다. 여행 서비스 데이터는 건드리지
            않고 잔광전선 로컬 세이브만 초기화합니다.
          </p>
          <button type="button" className="button button--primary" onClick={this.recover}>
            잔광전선 복구 후 다시 열기
          </button>
        </section>
      </main>
    );
  }
}
