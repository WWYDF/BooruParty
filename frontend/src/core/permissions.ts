// Client Side Component/Page -> This
export async function checkPermissions(permission: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/users/permissions', { cache: 'no-store' });

    if (!res.ok) {
      return { success: false };
    }

    const data = await res.json();

    const allowed = Array.isArray(data.permissions) &&
      (data.permissions.includes(permission) || data.permissions.includes('administrator'));

    return { success: allowed };
  } catch (err) {
    console.error('checkPermissions error:', err);
    return { success: false };
  }
}
