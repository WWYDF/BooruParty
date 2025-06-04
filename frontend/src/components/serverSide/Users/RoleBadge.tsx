import { hexToRgba } from "@/core/roles";

type Props = {
  role: {
    name: string;
    color?: string;
  }
  variant?: "full" | "badge" | "text";
  classes?: string;
};

export function RoleBadge({
  role,
  classes = 'text-xs ml-2',
}: Props) {
  const roleName = role?.name?.toLowerCase?.();

  if (!roleName || roleName === 'default' || roleName === 'member') return null;

  const backgroundColor = hexToRgba(role.color ?? '#85828B', 0.1);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${classes}`}
      style={{
        color: role.color,
        backgroundColor,
      }}
    >
      {role.name}
    </span>
  );
}