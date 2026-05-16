const TournamentModel = require('../models/tournamentModel');
const TeamModel = require('../models/teamModel');
const notificationService = require('../services/notificationService');
const { BracketGenerator, SingleEliminationStrategy } = require('../services/bracketService');
const MatchModel = require('../models/matchModel');

exports.create = async (req, res) => {
  try {
    const data = req.body;
    const tournament = {
      title: data.title,
      description: data.description,
      game: data.game,
      type: data.type,
      format: data.format,
      min_teams: data.minTeams || 2,
      max_teams: data.maxTeams || 16,
      registration_deadline: data.registrationDeadline,
      start_date: data.startDate,
      status: 'registration_open',
      platform: data.platform || null,
      created_by: req.user.id
    };
    const result = await TournamentModel.createRaw(tournament);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  const tournaments = await TournamentModel.findAll();
  res.json(tournaments);
};

exports.get = async (req, res) => {
  const tournament = await TournamentModel.findById(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Not found' });
  res.json(tournament);
};

exports.register = async (req, res) => {
  const tournamentId = req.params.id;
  const userId = req.user.id;
  const { type, teamName } = req.body; // type: 'solo' или 'team'

  // Создаём заявку
  const db = require('../config/db');
  let teamId = null;
  if (type === 'team') {
    const team = await TeamModel.create({ name: teamName, captainId: userId, tournamentId });
    teamId = team.id;
    await TeamModel.addMember(teamId, userId);
  }
  await db.query(
    `INSERT INTO participation_requests (user_id, team_id, tournament_id, type, status)
     VALUES ($1,$2,$3,$4,'pending')`,
    [userId, teamId, tournamentId, type]
  );

  // Уведомление организатору
  notificationService.notifyUser(
    (await TournamentModel.findById(tournamentId)).created_by,
    'new_request',
    { userId, tournamentId }
  );
  res.json({ message: 'Request sent' });
};

exports.approveRequest = async (req, res) => {
  const db = require('../config/db');
  const { requestId } = req.params;
  await db.query(`UPDATE participation_requests SET status='approved' WHERE id=$1`, [requestId]);
  // Уведомить пользователя
  const request = (await db.query('SELECT * FROM participation_requests WHERE id=$1', [requestId])).rows[0];
  notificationService.notifyUser(request.user_id, 'request_approved', { requestId, tournamentId: request.tournament_id });
  res.json({ message: 'Approved' });
};

exports.rejectRequest = async (req, res) => {
  const db = require('../config/db');
  const { requestId } = req.params;
  await db.query(`UPDATE participation_requests SET status='rejected' WHERE id=$1`, [requestId]);
  const request = (await db.query('SELECT * FROM participation_requests WHERE id=$1', [requestId])).rows[0];
  notificationService.notifyUser(request.user_id, 'request_rejected', { requestId });
  res.json({ message: 'Rejected' });
};

exports.startBracket = async (req, res) => {
  const tournamentId = req.params.id;
  const tournament = await TournamentModel.findById(tournamentId);
  if (tournament.status !== 'registration_closed') {
    await TournamentModel.updateStatus(tournamentId, 'registration_closed');
  }
  // Получить одобренные заявки-команды
  const db = require('../config/db');
  const approvedRequests = await db.query(
    "SELECT * FROM participation_requests WHERE tournament_id=$1 AND type='team' AND status='approved'",
    [tournamentId]
  );
  if (approvedRequests.rows.length < tournament.min_teams) {
    return res.status(400).json({ error: 'Not enough teams' });
  }
  // Формируем команды для стратегии
  const teams = approvedRequests.rows.map(r => ({ id: r.team_id }));
  const bracketGen = new BracketGenerator(new SingleEliminationStrategy());
  const matches = bracketGen.generate(teams, tournamentId);
  await MatchModel.createMany(matches);
  await TournamentModel.updateStatus(tournamentId, 'in_progress');
  notificationService.notifyAll('bracket_generated', { tournamentId });
  res.json({ message: 'Bracket generated', matches });
};

exports.reschedule = async (req, res) => {
  const { newDate } = req.body;
  await TournamentModel.reschedule(req.params.id, newDate);
  notificationService.notifyAll('tournament_rescheduled', { tournamentId: req.params.id, newDate });
  res.json({ message: 'Rescheduled' });
};