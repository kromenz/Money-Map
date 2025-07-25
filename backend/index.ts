import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Express 5 + TypeScript API Server");
});

const PORT = Number(process.env.PORT) || 5000;

app
  .listen(PORT, () => {
    console.log(`▶️ Listening on http://localhost:${PORT}`);
  })
  .on("error", (err: unknown) => {
    console.error("❌ Server failed:", err);
  });
