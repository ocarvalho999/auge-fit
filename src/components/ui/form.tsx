"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Alert } from "./feedback";
import { buttonClass } from "./button";

const FormStateContext = createContext<ActionState>({});

export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <FormStateContext.Provider value={state}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {children}
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      </form>
    </FormStateContext.Provider>
  );
}

const inputClass =
  "block min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-text placeholder:text-muted";

function FieldShell({
  id,
  name,
  label,
  hint,
  children,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const error = useContext(FormStateContext).fieldErrors?.[name];
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  name,
  label,
  hint,
  ...props
}: { name: string; label: string; hint?: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <FieldShell id={id} name={name} label={label} hint={hint}>
      <input id={id} name={name} className={inputClass} {...props} />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  ...props
}: { name: string; label: string; hint?: string } & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <FieldShell id={id} name={name} label={label} hint={hint}>
      <textarea id={id} name={name} rows={4} className={inputClass} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
} & ComponentProps<"select">) {
  const id = useId();
  return (
    <FieldShell id={id} name={name} label={label} hint={hint}>
      <select id={id} name={name} className={inputClass} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  children,
  ...props
}: { name: string; children: ReactNode } & ComponentProps<"input">) {
  const id = useId();
  const error = useContext(FormStateContext).fieldErrors?.[name];
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 items-start gap-3 py-1 text-sm">
        <input id={id} name={name} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-accent" {...props} />
        <span>{children}</span>
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "w-full",
  pendingLabel = "Enviando...",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
