import express from "express";
import { query } from "../db.js";
import { auth, requireRole } from "../middleware.js";
import { generateSingleEliminationRound } from "../services/bracket.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const result = await query(
    "SELECT t.*, u.nickname AS organizer FROM tournaments t JOIN users u ON u.id = t.created_by ORDER BY t.start_date ASC"
  );
  return res.json(result.rows);
});

router.post("/", auth, requireRole("organizer"), async (req, res) => {
  const {
    title,
    description,
    game,
    type,
    format,
    minTeams,
    maxTeams,
    registrationDeadline,
    startDate
  } = req.body;

  if (!title || !game || !type || !format || !registrationDeadline || !startDate) {
    return res.status(400).json({ message: "Missing required tournament fields" });
  }
  if (Number(minTeams) < 2 || Number(maxTeams) < 2 || Number(minTeams) > Number(maxTeams)) {
    return res.status(400).json({ message: "Invalid teams limits" });
  }
  const now = new Date();
  const regDate = new Date(registrationDeadline);
  const start = new Date(startDate);
  if (regDate >= start) {
    return res.status(400).json({ message: "Registration deadline must be earlier than start date" });
  }
  if (start <= now) {
    return res.status(400).json({ message: "Start date must be in the future" });
  }

  const result = await query(
    `INSERT INTO tournaments
      (title, description, game, type, format, min_teams, max_teams, registration_deadline, start_date, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      title,
      description ?? "",
      game,
      type,
      format,
      minTeams ?? 2,
      maxTeams ?? 16,
      registrationDeadline,
      startDate,
      req.user.id
    ]
  );
  return res.status(201).json(result.rows[0]);
});

// ПЕРЕНОС ТУРНИРА – исправленная версия
router.post("/:id/reschedule", auth, requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  const { startDate, registrationDeadline } = req.body;
  if (!startDate || !registrationDeadline) {
    return res.status(400).json({ message: "Missing new tournament dates" });
  }
  const newStart = new Date(startDate);
  const newRegDeadline = new Date(registrationDeadline);
  const now = new Date();

  if (newRegDeadline >= newStart) {
    return res.status(400).json({ message: "Registration deadline must be earlier than start date" });
  }
  if (newStart <= now) {
    return res.status(400).json({ message: "Start date must be in the future" });
  }
  if (newRegDeadline <= now) {
    return res.status(400).json({ message: "Registration deadline must be in the future" });
  }

  // Проверяем, что турнир принадлежит организатору и находится в допустимом статусе
  const tournamentCheck = await query(
    "SELECT status FROM tournaments WHERE id = $1 AND created_by = $2",
    [id, req.user.id]
  );
  if (!tournamentCheck.rowCount) {
    return res.status(404).json({ message: "Tournament not found" });
  }
  const currentStatus = tournamentCheck.rows[0].status;
  if (!["registration_open", "scheduled"].includes(currentStatus)) {
    return res.status(400).json({ message: "Cannot reschedule tournament that is already in progress or finished" });
  }

  // Обновляем даты, статус не меняем
  const result = await query(
    `UPDATE tournaments
       SET start_date = $1, registration_deadline = $2
     WHERE id = $3 AND created_by = $4
     RETURNING *`,
    [startDate, registrationDeadline, id, req.user.id]
  );

  // Обновляем start_time всех матчей этого турнира
  await query(`UPDATE matches SET start_time = $1 WHERE tournament_id = $2`, [startDate, id]);

  if (!result.rowCount) {
    return res.status(404).json({ message: "Tournament not found" });
  }
  return res.json(result.rows[0]);
});

router.post("/:id/force-start", auth, requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  const tournamentResult = await query("SELECT * FROM tournaments WHERE id = $1 AND created_by = $2", [id, req.user.id]);
  const tournament = tournamentResult.rows[0];

  if (!tournament) {
    return res.status(404).json({ message: "Tournament not found" });
  }

  if (!["scheduled", "registration_open"].includes(tournament.status)) {
    return res.status(400).json({ message: "Tournament cannot be force-started in current status" });
  }
  const matchesCount = await query("SELECT count(*)::int AS count FROM matches WHERE tournament_id = $1", [id]);
  if (matchesCount.rows[0].count === 0) {
    return res.status(400).json({ message: "Generate bracket before force start" });
  }

  await query("UPDATE matches SET start_time = now() WHERE tournament_id = $1 AND status != 'finished'", [id]);
  const result = await query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1 RETURNING *", [id]);
  return res.json(result.rows[0]);
});

router.post("/:id/generate-bracket", auth, requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  const tournamentResult = await query("SELECT * FROM tournaments WHERE id = $1 AND created_by = $2", [id, req.user.id]);
  const tournament = tournamentResult.rows[0];

  if (!tournament) {
    return res.status(404).json({ message: "Tournament not found" });
  }
  if (new Date() < new Date(tournament.registration_deadline)) {
  return res.status(400).json({ message: "Registration is still open" });
  }
  // Если статус scheduled, но матчей нет – всё равно разрешаем генерацию
  if (tournament.status === 'scheduled') {
    const existingMatches = await query("SELECT 1 FROM matches WHERE tournament_id = $1 LIMIT 1", [id]);
  if (existingMatches.rowCount > 0) {
    return res.status(400).json({ message: "Bracket already generated" });
  }
  // иначе продолжаем (разрешено)
  }

  const teamsResult = await query(
    `SELECT DISTINCT pr.team_id
     FROM participation_requests pr
     JOIN teams t ON t.id = pr.team_id AND t.tournament_id = pr.tournament_id
     WHERE pr.tournament_id = $1
       AND pr.status = 'approved'
       AND pr.team_id IS NOT NULL`,
    [id]
  );

  const teamIds = teamsResult.rows.map((row) => row.team_id);
  if (teamIds.length > tournament.max_teams) {
    return res.status(400).json({ message: "Approved teams exceed tournament max teams" });
  }
  if (teamIds.length < tournament.min_teams) {
    return res.status(400).json({ message: "Not enough teams to generate bracket" });
  }

  if (tournament.format !== "single_elim") {
    return res.status(400).json({ message: "MVP supports bracket generation for single_elim only" });
  }

  const firstRoundMatches = generateSingleEliminationRound(teamIds);
  await query("DELETE FROM matches WHERE tournament_id = $1", [id]);

  for (const match of firstRoundMatches) {
    await query(
      `INSERT INTO matches (tournament_id, round, team1_id, team2_id, start_time, status, winner_id, score1, score2)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        1,
        match.team1Id,
        match.team2Id,
        tournament.start_date,
        match.status,
        match.winnerId,
        match.score1,
        match.score2
      ]
    );
  }

  await query("UPDATE tournaments SET status = 'scheduled' WHERE id = $1", [id]);
  return res.json({ message: "Bracket generated", matches: firstRoundMatches.length });
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const tournamentResult = await query("SELECT * FROM tournaments WHERE id = $1", [id]);
  if (!tournamentResult.rowCount) {
    return res.status(404).json({ message: "Tournament not found" });
  }

  const matches = await query(
    `SELECT
      m.*,
      t1.name AS team1_name,
      t2.name AS team2_name,
      tw.name AS winner_name
    FROM matches m
    JOIN teams t1 ON t1.id = m.team1_id
    JOIN teams t2 ON t2.id = m.team2_id
    LEFT JOIN teams tw ON tw.id = m.winner_id
    WHERE m.tournament_id = $1
    ORDER BY m.round, m.id`,
    [id]
  );
  const teams = await query(
    `SELECT DISTINCT t.*
     FROM teams t
     JOIN participation_requests pr ON pr.team_id = t.id
     WHERE t.tournament_id = $1
       AND pr.tournament_id = $1
       AND pr.status = 'approved'
     ORDER BY t.created_at ASC`,
    [id]
  );
  return res.json({
    tournament: tournamentResult.rows[0],
    teams: teams.rows,
    matches: matches.rows
  });
});

export default router;
