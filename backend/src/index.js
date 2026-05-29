import "dotenv/config";
import express from "express";
import cors from "cors";
import { CronJob } from "cron";
import authRoutes from "./routes/auth.js";
import tournamentRoutes from "./routes/tournaments.js";
import teamRoutes from "./routes/teams.js";
import matchRoutes from "./routes/matches.js";
import { initDb, query } from "./db.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/matches", matchRoutes);

// Функция автоматического обновления статусов турниров (запускается каждую минуту)
function scheduleStatusUpdates() {
  new CronJob(
    "* * * * *", // каждая минута
    async () => {
      const now = new Date();
      try {
        // 1. Закрываем регистрацию, если дедлайн прошёл
        await query(`
          UPDATE tournaments 
          SET status = 'scheduled' 
          WHERE status = 'registration_open' 
            AND registration_deadline < $1
        `, [now]);

        // 2. Автоматически стартуем турниры, у которых наступила дата старта и есть сетка
        await query(`
          UPDATE tournaments 
          SET status = 'in_progress' 
          WHERE status = 'scheduled' 
            AND start_date < $1
            AND EXISTS (SELECT 1 FROM matches WHERE tournament_id = tournaments.id LIMIT 1)
        `, [now]);

        // 3. Завершаем пустые турниры (нет одобренных команд)
        await query(`
          UPDATE tournaments 
          SET status = 'finished' 
          WHERE status = 'registration_open' 
            AND registration_deadline < $1
            AND NOT EXISTS (
              SELECT 1 FROM participation_requests 
              WHERE tournament_id = tournaments.id 
                AND status = 'approved' 
                AND team_id IS NOT NULL
            )
        `, [now]);

        // 4. Завершаем турниры, у которых все матчи finished, но статус остался in_progress (на всякий случай)
        await query(`
          UPDATE tournaments 
          SET status = 'finished' 
          WHERE status = 'in_progress' 
            AND NOT EXISTS (
              SELECT 1 FROM matches 
              WHERE tournament_id = tournaments.id 
                AND status != 'finished'
            )
        `);
      } catch (err) {
        console.error("Cron job error:", err);
      }
    },
    null,      // onComplete
    true,      // start
    "Europe/Moscow" // часовой пояс (подставьте свой, либо "UTC")
  );
}

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend started on http://localhost:${port}`);
    });
    scheduleStatusUpdates();
    console.log("Status update cron job scheduled");
  })
  .catch((error) => {
    console.error("Failed to initialize DB", error);
    process.exit(1);
  });