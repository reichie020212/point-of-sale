'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { createOrg, type CreateOrgState } from './actions';

const initialState: CreateOrgState | null = null;

export default function OnboardingPage() {
  const [state, formAction] = useFormState(createOrg, initialState);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Create your shop</h1>
      <p className="mt-2 text-ink-2">
        Name your shop and pick the region where its data lives.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <Field label="Shop name" name="name" placeholder="Saoirse Bakery" required />
        <Field
          label="URL slug"
          name="slug"
          placeholder="saoirse-bakery"
          hint="Lowercase letters, numbers, and hyphens. Used in URLs and exports."
          required
        />
        <RegionPicker />
        {/* TODO(open-question): tax engine selector lands here once
            HANDOFF §9 is resolved. Region pinning is the only pre-launch
            commitment. */}

        {state && !state.ok && (
          <p className="rounded-md border border-bad bg-surface px-3 py-2 text-sm text-bad">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
  hint,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent-deep"
      />
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function RegionPicker() {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-ink">Data region</legend>
      <p className="mt-1 text-xs text-ink-3">
        Pinned at sign-up — your shop&apos;s data lives in this region permanently.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <RegionOption value="US" label="United States" subtitle="us-east" defaultChecked />
        <RegionOption value="EU" label="European Union" subtitle="eu-west" />
      </div>
    </fieldset>
  );
}

function RegionOption({
  value,
  label,
  subtitle,
  defaultChecked,
}: {
  value: string;
  label: string;
  subtitle: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-2 bg-surface px-3 py-3 hover:bg-surface-2 has-[:checked]:border-accent-deep has-[:checked]:bg-accent-soft">
      <input
        type="radio"
        name="region"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block font-mono text-xs text-ink-3">{subtitle}</span>
      </span>
    </label>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-ink px-5 py-3 font-medium text-bg shadow-card hover:bg-ink-2 disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Create shop'}
    </button>
  );
}
