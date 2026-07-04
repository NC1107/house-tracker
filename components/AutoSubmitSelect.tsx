"use client";

/**
 * A <select> that submits its enclosing form on change, so dependent dropdowns
 * (metros/cities for a state) refresh without pressing the submit button.
 */
export default function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.submit()}
    >
      {children}
    </select>
  );
}
