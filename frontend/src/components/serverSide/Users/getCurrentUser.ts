export async function getCurrentUser() {
    const res = await fetch('/api/users', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  
    if (!res.ok) {
      throw new Error('Failed to load user info');
    }
  
    return await res.json();
}