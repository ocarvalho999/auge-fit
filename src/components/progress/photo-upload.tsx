"use client";

import { useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { uploadPhotoAction } from "@/features/progress/actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

// A Vercel limita o corpo da requisição a cerca de 4,5 MB. Reduz no aparelho antes de enviar;
// o servidor reprocessa de qualquer forma.
const TARGET_BYTES = 4 * 1024 * 1024;

async function shrink(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
}

export function PhotoUpload({ today }: { today: string }) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const file = form.get("photo");
      if (file instanceof File && file.size > 0) {
        try {
          form.set("photo", await shrink(file));
        } catch {
          setState({ fieldErrors: { photo: "Envie uma imagem JPEG, PNG ou WebP válida." } });
          return;
        }
      }
      const result = await uploadPhotoAction(initialActionState, form);
      setState(result);
      if (result.ok) formRef.current?.reset();
    });
  }

  const inputClass = "block min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base";
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="photo" className="mb-1.5 block text-sm font-medium">
          Foto (JPEG, PNG ou WebP, até 10 MB)
        </label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
        {state.fieldErrors?.photo ? <p role="alert" className="mt-1 text-sm text-danger">{state.fieldErrors.photo}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pose" className="mb-1.5 block text-sm font-medium">
            Pose
          </label>
          <select id="pose" name="pose" className={inputClass}>
            <option value="front">Frente</option>
            <option value="side">Lado</option>
            <option value="back">Costas</option>
          </select>
        </div>
        <div>
          <label htmlFor="takenOn" className="mb-1.5 block text-sm font-medium">
            Data
          </label>
          <input id="takenOn" name="takenOn" type="date" defaultValue={today} className={inputClass} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Enviando..." : "Enviar foto"}
      </button>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
    </form>
  );
}
