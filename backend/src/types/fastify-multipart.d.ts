import '@fastify/multipart';

declare module 'fastify' {
  interface FastifyRequest {
    // Just for TS autocomplete / narrowing `postId`
    // No need to redefine parts() unless you're changing it
    // So we remove any custom `parts` declarations
  }
}
