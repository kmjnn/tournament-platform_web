import express from "express";
import { query } from "../db.js";
import { auth } from "../middleware.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  const { name, tournamentId } = req.body;
  if (!name || !tournamentId) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const tournamentResult = await query("SELECT id FROM tournaments WHERE id = $1", [tournamentId]);
  if (!tournamentResult.rowCount) {
    return res.status(404).json({ message: "Tournament not found" });
  }

  const teamResult = await query(
    "INSERT INTO teams (name, registered_by, tournament_id) VALUES ($1, $2, $3) RETURNING *",
    [name, req.user.id, tournamentId]
  );
  const team = teamResult.rows[0];

  await query("INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)", [team.id, req.user.id]);

  return res.status(201).json(team);
});

router.post("/requests", auth, async (req, res) => {
  const { tournamentId, teamId, mode, lookingForTeam } = req.body;
  if (!tournamentId || !mode) {
    return res.status(400).json({ message: "Missing fields" });
  }
  if (!["solo", "team"].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode" });
  }
  if (mode === "team" && !teamId) {
    return res.status(400).json({ message: "teamId is required for team mode" });
  }

  const tournamentCheck = await query("SELECT * FROM tournaments WHERE id = $1", [tournamentId]);
  const tournament = tournamentCheck.rows[0];
  if (!tournament) {
    return res.status(404).json({ message: "Tournament not found" });
  }
  if (new Date() > new Date(tournament.registration_deadline)) {
    return res.status(400).json({ message: "Registration is closed" });
  }
  if (tournament.status !== "registration_open") {
    return res.status(400).json({ message: "Tournament is not accepting applications" });
  }

  if (mode === "team") {
    const teamValidation = await query(
      "SELECT id FROM teams WHERE id = $1 AND tournament_id = $2",
      [teamId, tournamentId]
    );
    if (!teamValidation.rowCount) {
      return res.status(400).json({ message: "Team does not belong to this tournament" });
    }
  }

  const duplicate = await query(
    "SELECT id FROM participation_requests WHERE user_id = $1 AND tournament_id = $2 AND status = 'pending'",
    [req.user.id, tournamentId]
  );
  if (duplicate.rowCount) {
    return res.status(400).json({ message: "You already have a pending request" });
  }

  const result = await query(
    `INSERT INTO participation_requests (user_id, team_id, tournament_id, mode, looking_for_team)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.user.id, teamId ?? null, tournamentId, mode, Boolean(lookingForTeam)]
  );
  return res.status(201).json(result.rows[0]);
});

router.patch("/requests/:id", auth, async (req, res) => {
  if (req.user.role !== "organizer") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const ownerCheck = await query(
    `SELECT pr.id
     FROM participation_requests pr
     JOIN tournaments t ON t.id = pr.tournament_id
     WHERE pr.id = $1 AND t.created_by = $2`,
    [id, req.user.id]
  );
  if (!ownerCheck.rowCount) {
    return res.status(403).json({ message: "You can manage requests only in your tournaments" });
  }

  if (status === "approved") {
    const requestResult = await query("SELECT * FROM participation_requests WHERE id = $1", [id]);
    const request = requestResult.rows[0];
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const tournamentResult = await query("SELECT max_teams FROM tournaments WHERE id = $1", [request.tournament_id]);
    const maxTeams = tournamentResult.rows[0]?.max_teams ?? 0;
    const approvedCountResult = await query(
      `SELECT count(DISTINCT team_id)::int AS count
       FROM participation_requests
       WHERE tournament_id = $1 AND status = 'approved' AND team_id IS NOT NULL`,
      [request.tournament_id]
    );
    const approvedCount = approvedCountResult.rows[0].count;
    const isTeamRequest = Boolean(request.team_id);
    if (isTeamRequest && approvedCount >= maxTeams) {
      return res.status(400).json({ message: "Tournament already has maximum approved teams" });
    }
  }

  const result = await query(`UPDATE participation_requests SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
  if (!result.rowCount) {
    return res.status(404).json({ message: "Request not found" });
  }
  return res.json(result.rows[0]);
});

router.get("/tournaments/:id/requests", auth, async (req, res) => {
  const result = await query(
    `SELECT pr.*, u.nickname, t.name AS team_name
     FROM participation_requests pr
     JOIN users u ON u.id = pr.user_id
     LEFT JOIN teams t ON t.id = pr.team_id
     WHERE pr.tournament_id = $1
     ORDER BY pr.created_at DESC`,
    [req.params.id]
  );
  return res.json(result.rows);
});

router.get("/my-requests", auth, async (req, res) => {
  const result = await query(
    `SELECT
      pr.id,
      pr.mode,
      pr.status,
      pr.created_at,
      t.id AS tournament_id,
      t.title AS tournament_title,
      tm.name AS team_name
    FROM participation_requests pr
    JOIN tournaments t ON t.id = pr.tournament_id
    LEFT JOIN teams tm ON tm.id = pr.team_id
    WHERE pr.user_id = $1
    ORDER BY pr.created_at DESC`,
    [req.user.id]
  );
  return res.json(result.rows);
});

export default router;
