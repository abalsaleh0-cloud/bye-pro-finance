import type {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes,
  PropsWithChildren, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes
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

export function IconButton({ label, children, className = "", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>) {
  return <button {...props} type={props.type ?? "button"} aria-label={label} title={props.title ?? label} className={["ui-icon-button", className].filter(Boolean).join(" ")}>{children}</button>;
}
export function ButtonGroup({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div {...props} role="group" className={["ui-button-group", className].filter(Boolean).join(" ")}>{children}</div>;
}
export function Card({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section {...props} className={["ui-card", className].filter(Boolean).join(" ")}>{children}</section>;
}
export function Panel({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section {...props} className={["ui-panel", className].filter(Boolean).join(" ")}>{children}</section>;
}
export function CardHeader({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div {...props} className={["ui-card__header", className].filter(Boolean).join(" ")}>{children}</div>;
}
export function Badge({ children, tone = "neutral", className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" }>) {
  return <span {...props} className={["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ")}>{children}</span>;
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
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={["ui-textarea", className].filter(Boolean).join(" ")} />;
}
export function Field({ label, htmlFor, helper, error, children, required = false, className = "" }: { label?: ReactNode; htmlFor?: string; helper?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  const describedBy = [helper ? `${htmlFor}-helper` : "", error ? `${htmlFor}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className={["ui-field", className].filter(Boolean).join(" ")}>
    {label ? <FieldLabel htmlFor={htmlFor}>{label}{required ? <span aria-hidden="true"> *</span> : null}</FieldLabel> : null}
    <div aria-describedby={describedBy} aria-invalid={error ? true : undefined}>{children}</div>
    {helper ? <div id={htmlFor ? `${htmlFor}-helper` : undefined} className="ui-field__helper">{helper}</div> : null}
    {error ? <div id={htmlFor ? `${htmlFor}-error` : undefined} className="ui-field__error" role="alert">{error}</div> : null}
  </div>;
}
export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} type="checkbox" className={["ui-checkbox", props.className].filter(Boolean).join(" ")} />; }
export function Radio(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} type="radio" className={["ui-radio", props.className].filter(Boolean).join(" ")} />; }
export function Switch(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} type="checkbox" role="switch" className={["ui-switch", props.className].filter(Boolean).join(" ")} />; }
export function Divider({ className = "", ...props }: HTMLAttributes<HTMLHRElement>) { return <hr {...props} className={["ui-divider", className].filter(Boolean).join(" ")} />; }
export function EmptyState({ title, description, action, className = "" }: { title: string; description?: string; action?: ReactNode; className?: string }) { return <div className={["ui-empty-state", className].filter(Boolean).join(" ")} role="status"><h3>{title}</h3>{description ? <p>{description}</p> : null}{action}</div>; }
export function LoadingState({ label = "Loading…" }: { label?: string }) { return <div className="ui-loading" role="status" aria-live="polite"><span className="ui-spinner" aria-hidden="true" />{label}</div>; }
export function Skeleton({ className = "" }: { className?: string }) { return <span className={["ui-skeleton", className].filter(Boolean).join(" ")} aria-hidden="true" />; }
export function Alert({ children, tone = "neutral", className = "" }: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger"; className?: string }>) { return <div className={["ui-alert", `ui-alert--${tone}`, className].filter(Boolean).join(" ")} role={tone === "danger" ? "alert" : "status"}>{children}</div>; }
export function Modal({ open, title, description, children, onClose, actions, danger = false }: { open: boolean; title: string; description?: string; children?: ReactNode; onClose: () => void; actions?: ReactNode; danger?: boolean }) {
  if (!open) return null;
  return <div className="ui-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={["ui-modal", danger ? "ui-modal--danger" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true" aria-labelledby="ui-modal-title" aria-describedby={description ? "ui-modal-description" : undefined}>
    <div className="ui-modal__head"><div><h2 id="ui-modal-title">{title}</h2>{description ? <p id="ui-modal-description">{description}</p> : null}</div><IconButton label="Close" onClick={onClose}>×</IconButton></div>
    {children ? <div className="ui-modal__body">{children}</div> : null}<div className="ui-modal__actions">{actions}</div>
  </section></div>;
}
export function ConfirmDialog(props: Omit<React.ComponentProps<typeof Modal>, "danger"> & { danger?: boolean }) { return <Modal {...props} danger={props.danger} />; }
export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children?: ReactNode; onClose: () => void }) { return open ? <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}><div className="ui-drawer__head"><h2>{title}</h2><IconButton label="Close" onClick={onClose}>×</IconButton></div>{children}</aside> : null; }
export function Sheet(props: React.ComponentProps<typeof Drawer>) { return <Drawer {...props} />; }
export function Toast({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger" }>) { return <div className={["ui-toast", `ui-toast--${tone}`].join(" ")} role="status">{children}</div>; }
export function Tabs({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) { return <div {...props} className={["ui-tabs", className].filter(Boolean).join(" ")}>{children}</div>; }
export function Dropdown({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) { return <div {...props} className={["ui-dropdown", className].filter(Boolean).join(" ")}>{children}</div>; }
export function Tooltip({ label, children }: PropsWithChildren<{ label: string }>) { return <span className="ui-tooltip" data-tooltip={label}>{children}</span>; }
export function Avatar({ src, alt = "", children }: { src?: string; alt?: string; children?: ReactNode }) { return <span className="ui-avatar">{src ? <img src={src} alt={alt} /> : children}</span>; }
export function AvatarEditor({ children }: PropsWithChildren) { return <div className="ui-avatar-editor">{children}</div>; }
export function Pagination({ children }: PropsWithChildren) { return <nav className="ui-pagination" aria-label="Pagination">{children}</nav>; }
export function DataTable({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) { return <div {...props} className={["ui-table-scroll", className].filter(Boolean).join(" ")}>{children}</div>; }
export function IconButtonGroup({ children }: PropsWithChildren) { return <div className="ui-button-group">{children}</div>; }
