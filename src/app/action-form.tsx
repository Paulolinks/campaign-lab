"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

/** A form bound to a server action that returns an ActionState; shows its message and disables while sending. */
export function ActionForm({
  action,
  children,
  className = "flex flex-col gap-3",
  resetOnSuccess = false,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  // Submitting through onSubmit keeps what was typed when the action returns an error.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <fieldset disabled={pending} className={className}>
        {children}
      </fieldset>
      {state?.error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="mt-2 text-sm text-success">{state.ok}</p>}
    </form>
  );
}
