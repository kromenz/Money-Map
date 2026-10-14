import { handle } from "./handler";
import { d1Store } from "./d1-store";

type Env = { DB: D1Database; DESKTOP_TOKEN: string };

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, d1Store(env.DB));
  },
} satisfies ExportedHandler<Env>;
