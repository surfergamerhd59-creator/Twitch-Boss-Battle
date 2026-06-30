declare module "tmi.js" {
  interface Options {
    options?: { debug?: boolean };
    identity?: { username: string; password: string };
    channels?: string[];
    connection?: { reconnect?: boolean; secure?: boolean };
  }
  class Client {
    constructor(opts: Options);
    connect(): Promise<[string, number]>;
    disconnect(): Promise<[string, number]>;
    join(channel: string): Promise<[string]>;
    part(channel: string): Promise<[string]>;
    say(channel: string, message: string): Promise<[string, string]>;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }
  export { Client };
}
