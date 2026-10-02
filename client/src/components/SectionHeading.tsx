import type { ReactNode } from "react";

/**
 * Título de seção. O título é a peça tipográfica; o texto de apoio fica opcional e curto.
 */
export function SectionHeading({
  id,
  title,
  children,
  align = "left",
  action,
}: {
  id: string;
  title: string;
  children?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
}) {
  return (
    <div
      className={`mb-10 flex flex-col gap-5 sm:mb-14 md:flex-row md:items-end md:justify-between ${
        align === "center" ? "items-center text-center md:flex-col md:items-center" : ""
      }`}
    >
      <div className="max-w-2xl">
        <h2 id={id} className="display text-[clamp(2.75rem,8vw,5.5rem)]">
          {title}
        </h2>
        {children && <div className="mt-4 text-lg text-mist">{children}</div>}
      </div>
      {action}
    </div>
  );
}
