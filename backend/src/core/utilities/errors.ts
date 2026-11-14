// Throw inside a prisma.$transaction to roll it back and send a specific response
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: { error: string, hint?: string, [key: string]: unknown },
  ) {
    super(body.error);
  }
}
