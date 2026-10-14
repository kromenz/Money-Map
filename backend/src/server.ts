import app from "./app";
import config from "./config";
import { startT212Scheduler } from "./modules/t212/t212.scheduler";
import { startInboxScheduler } from "./modules/inbox/inbox.scheduler";

app.listen(config.port, () => {
  console.log(`Server listening on ${config.port}`);
  startT212Scheduler();
  startInboxScheduler();
});
