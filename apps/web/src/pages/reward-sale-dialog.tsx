import { CircleDollarSign, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { point } from "./points-shared";

export function RewardSaleDialog({
  itemTitle,
  refundedPoints,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  itemTitle: string;
  refundedPoints: number;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === cancelRef.current) {
        event.preventDefault();
        confirmRef.current?.focus();
      } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
        event.preventDefault();
        cancelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [onCancel, pending]);

  return (
    <div
      className="reward-sale-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        className="reward-sale-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reward-sale-title"
        aria-describedby="reward-sale-description"
      >
        <div className="reward-sale-icon">
          <CircleDollarSign aria-hidden="true" />
        </div>
        <span>아이템 판매</span>
        <h2 id="reward-sale-title">‘{itemTitle}’을 판매할까요?</h2>
        <p id="reward-sale-description">
          실제 구매가의 70%인 <strong>{point(refundedPoints)}</strong>가 즉시 환급됩니다.
          판매한 아이템은 되돌릴 수 없습니다.
        </p>
        <div className="reward-sale-warning">
          <TriangleAlert aria-hidden="true" /> 무료로 지급받은 아이템은 판매되지 않습니다.
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="reward-sale-actions">
          <button
            ref={cancelRef}
            className="button button--secondary"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            ref={confirmRef}
            className="button button--primary"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "판매 중…" : `${point(refundedPoints)}에 판매`}
          </button>
        </div>
      </section>
    </div>
  );
}
