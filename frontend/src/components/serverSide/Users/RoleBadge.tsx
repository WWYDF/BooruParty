import { ROLE_BADGE } from "@/core/dictionary";
import { IconWeight } from "phosphor-react";

type Props = {
  role: string;
  variant?: "full" | "badge" | "text";
  size?: number;
  weight?: IconWeight;
};

export function RoleBadge({
  role,
  variant,
  size = 14,
  weight = 'regular',
}: Props) {
  const meta = ROLE_BADGE[role];
  if (!meta) return null;

  const Icon = meta.icon;

  // Automatically prefer text variant for high-importance roles
  const resolvedVariant = variant ?? (meta.importance === "high" ? "text" : "badge");

  if (resolvedVariant === "badge") {
    return (
      <span className={`inline-flex items-center align-center ml-2 ${meta.color}`}>
        <Icon size={size} weight={weight} />
      </span>
    );
  }

  if (resolvedVariant === "text") {
    return (
      <span
        className={`px-2 py-0.5 rounded-md text-xs font-medium ml-2 ${meta.color}`}
      >
        {meta.label}
      </span>
    );
  }

  // "full"
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ml-2 ${meta.color}`}
    >
      <Icon size={size} weight="duotone" />
      {meta.label}
    </span>
  );
}
