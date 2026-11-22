"use client";

import { useRef } from "react";
import { selectBrand } from "../actions";

export function BrandSwitcher({ brands, currentId }: { brands: { id: string; name: string }[]; currentId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  if (brands.length === 0) return null;
  return (
    <form ref={formRef} action={selectBrand} className="min-w-44">
      <select
        name="brandId"
        aria-label="Marca ativa"
        defaultValue={currentId ?? undefined}
        key={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="font-semibold"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </form>
  );
}
