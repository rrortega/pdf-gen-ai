export type ClosableMcpResource = {
  close: () => Promise<void> | void;
};

export type McpSession<T extends ClosableMcpResource = ClosableMcpResource> = {
  owner: string;
  resource: T;
};

/**
 * Associates an SSE session with the exact credential that created it. The
 * credential is only retained in process memory for the session lifetime.
 */
export class McpSessionStore<T extends ClosableMcpResource = ClosableMcpResource> {
  private readonly sessions = new Map<string, McpSession<T>>();

  add(sessionId: string, owner: string, resource: T): void {
    this.sessions.set(sessionId, { owner, resource });
  }

  get(sessionId: string, owner: string): McpSession<T> | undefined {
    const session = this.sessions.get(sessionId);
    return session?.owner === owner ? session : undefined;
  }

  async close(sessionId: string, owner?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || (owner !== undefined && session.owner !== owner)) return;

    this.sessions.delete(sessionId);
    await session.resource.close();
  }
}
