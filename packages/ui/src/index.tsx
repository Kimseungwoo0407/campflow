import { Slot } from "@radix-ui/react-slot";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({
  asChild,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={classes("button", `button--${variant}`, className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={classes("card", className)} {...props} />;
}

export interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}

export function Field({ label, error, hint, labelProps, inputProps }: FieldProps) {
  const messageId = inputProps.id ? `${inputProps.id}-message` : undefined;
  return (
    <label className="field" {...labelProps}>
      <span className="field__label">{label}</span>
      <input
        {...inputProps}
        className={classes("input", inputProps.className)}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
      />
      {(error ?? hint) && (
        <span id={messageId} className={classes("field__message", error && "field__message--error")}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__icon" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = "불러오는 중" }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <span aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
