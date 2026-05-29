import express from "express";
import { query } from "../db.js";
import { auth, requireRole } from "../middleware.js";

const router = express.Router();

async function createNextRoundIfReady(tournamentId, round) {
  const currentRoundResult = await query(
    "SELECT * FROM matches WHERE tournament_id = $1 AND round = $2 ORDER BY id",
    [tournamentId, round]
  );
  const currentRoundMatches = currentRoundResult.rows;
  if (!currentRoundMatches.length) return;

  const allFinished = currentRoundMatches.every((match) => match.status === "finished" && match.winner_id);
  if (!allFinished) return;

  const nextRound = round + 1;
  const nextRoundExists = await query(
    "SELECT count(*)::int AS count FROM matches WHERE tournament_id = $1 AND round = $2",
    [tournamentId, nextRound]
  );
  if (nextRoundExists.rows[0].count > 0) return;

  const winners = currentRoundMatches.map((match) => match.winner_id);
  if (winners.length === 1) return;

  for (let i = 0; i < winners.length; i += 2) {
    const team1 = winners[i];
    const team2 = winners[i + 1];
    if (!team2) {
      await query(
        `INSERT INTO matches (tournament_id, round, team1_id, team2_id, score1, score2, status, winner_id, start_time)
         VALUES ($1, $2, $3, $3, 1, 0, 'finished', $3, now())`,
        [tournamentId, nextRound, team1]
      );
    } else {
      await query(
        `INSERT INTO matches (tournament_id, round, team1_id, team2_id, status, start_time)
         VALUES ($1, $2, $3, $4, 'scheduled', now())`,
        [tournamentId, nextRound, team1, team2]
      );
    }
  }
}

router.patch("/:id/result", auth, requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  const { score1, score2 } = req.body;

  if (typeof score1 !== "number" || typeof score2 !== "number") {
    return res.status(400).json({ message: "Invalid scores" });
  }
  if (score1 === score2) {
    return res.status(400).json({ message: "Draws are not allowed in elimination matches" });
  }

  const matchResult = await query(
    `SELECT m.*, t.start_date, t.status AS tournament_status
     FROM matches m
     JOIN tournaments t ON t.id = m.tournament_id
     WHERE m.id = $1`,
    [id]
  );
  const match = matchResult.rows[0];
  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }
  if (match.status === "finished") {
    return res.status(400).json({ message: "Match result already submitted" });
  }
  // ИСПРАВЛЕНО: используем start_time матча, а не start_date турнира
  if (new Date() < new Date(match.start_time)) {
    return res.status(400).json({ message: "Match has not started yet" });
  }
  if (!["scheduled", "in_progress"].includes(match.tournament_status)) {
    return res.status(400).json({ message: "Tournament is not in active stage" });
  }

  const winnerId = score1 >= score2 ? match.team1_id : match.team2_id;

  const result = await query(
    `UPDATE matches
     SET score1 = $1, score2 = $2, winner_id = $3, status = 'finished'
     WHERE id = $4
     RETURNING *`,
    [score1, score2, winnerId, id]
  );

  await query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1 AND status = 'scheduled'", [match.tournament_id]);
  await createNextRoundIfReady(match.tournament_id, match.round);

  const pendingMatches = await query(
    "SELECT COUNT(*)::int AS count FROM matches WHERE tournament_id = $1 AND status != 'finished'",
    [match.tournament_id]
  );
  if (pendingMatches.rows[0].count === 0) {
    await query("UPDATE tournaments SET status = 'finished' WHERE id = $1", [match.tournament_id]);
  }

  return res.json(result.rows[0]);
});

export default router;