// Just a list of incoming request schemas so we have consistency

export const usernameSchema = { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_.-]+$' } as const;
export const emailSchema = { type: 'string', format: 'email', maxLength: 254 } as const;
export const passwordSchema = { type: 'string', minLength: 8, maxLength: 72 } as const;
export const hexColorSchema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } as const;