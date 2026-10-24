import type {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes,
  PropsWithChildren, SelectHTMLAttributes
} from "react";

type Tone = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone; size?: Size; fullWidth?: boolean; loading?: boolean;
}>;
export function Button({ children, tone = "primary", size = "md", fullWidth = false, loading = false, disabled, className = "", ...props }: ButtonProps) {
  return <button {...props} className={["ui-button", `ui-button--${tone}`, `ui-button--${size}`, fullWidth ? "ui-button--full" : "", className].filter(Boolean).join(" ")} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading ? <span className="ui-spinner" aria-hidden="true" /> : null}{children}
  </button>;
}

export function Card({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section {...props} className={["ui-card", className].filter(Boolean).join(" ")}>{children}</section>;
}
export function CardHeader({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div {...props} className={["ui-card__header", className].filter(Boolean).join(" ")}>{children}</div>;
}
export function Badge({ children, tone = "neutral", className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" }>) {
  return <span {...props} className={["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ")}>{children}</span>;
}
export function IconButton({ label, children, className = "", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>) {
  return <button {...props} type={props.type ?? "button"} aria-label={label} title={props.title ?? label} className={["ui-icon-button", className].filter(Boolean).join(" ")}>{children}</button>;
}
export function FieldLabel({ children, className = "", ...props }: PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>) {
  return <label {...props} className={["ui-field-label", className].filter(Boolean).join(" ")}>{children}</label>;
}
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["ui-input", className].filter(Boolean).join(" ")} />;
}
export function Select({ className = "", children, ...props }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) {
  return <select {...props} className={["ui-select", className].filter(Boolean).join(" ")}>{children}</select>;
}
export function Divider({ className = "", ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={["ui-divider", className].filter(Boolean).join(" ")} />;
}
export function EmptyState({ title, description, action, className = "" }: { title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return <div className={["ui-empty-state", className].filter(Boolean).join(" ")} role="status"><h3>{title}</h3>{description ? <p>{description}</p> : null}{action}</div>;
}
