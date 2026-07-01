import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: ButtonVariant;
};

const joinClass = (base: string, extra?: string): string => (extra === undefined || extra.length === 0 ? base : `${base} ${extra}`);

export function Button({ children, className, type = "button", variant = "secondary", ...props }: ButtonProps): ReactElement {
  return (
    <button {...props} className={joinClass(`ui-button ui-button-${variant}`, className)} type={type}>
      {children}
    </button>
  );
}

export function Surface(props: { readonly children: ReactNode; readonly className?: string; readonly testId?: string }): ReactElement {
  return (
    <section className={joinClass("ui-surface", props.className)} data-testid={props.testId}>
      {props.children}
    </section>
  );
}

export function Field(props: { readonly children: ReactNode; readonly label: string }): ReactElement {
  return (
    <label className="ui-field">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return <input {...props} className={joinClass("ui-control", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea {...props} className={joinClass("ui-control", props.className)} />;
}

export function WarningBanner(props: { readonly children: ReactNode }): ReactElement {
  return <div className="warning-banner">{props.children}</div>;
}
