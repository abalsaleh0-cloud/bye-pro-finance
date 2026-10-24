import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({ children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button {...props}>{children}</button>;
}

export function Card({ children }: PropsWithChildren) {
  return <section className="ui-card">{children}</section>;
}
