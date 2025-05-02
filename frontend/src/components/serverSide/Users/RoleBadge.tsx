import { ROLE_BADGE } from "@/core/roles";

type Props = {
  role: string;
  variant?: "full" | "badge" | "text";
  classes?: string;
};

export function RoleBadge({
  role,
  classes = 'text-xs ml-2',
}: Props) {
  const meta = ROLE_BADGE[role];
  if (!meta) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${classes} font-medium ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}
