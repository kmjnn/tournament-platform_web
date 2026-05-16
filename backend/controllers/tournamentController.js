const TournamentModel = require('../models/tournamentModel');
const TeamModel = require('../models/teamModel');
const notificationService = require('../services/notificationService');
const MatchModel = require('../models/matchModel');
const { BracketGenerator, SingleEliminationStrategy } = require('../services/bracketService');

exports.getMyRequests = async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const userId = req.user.id;
        const requests = await TournamentModel.getMyRequests(userId, tournamentId);
        res.json(requests);
    } catch (err) {
        console.error('Ошибка получения заявок пользователя:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

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

// Заменить существующий метод startBracket на этот:
exports.startBracket = async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const tournament = await TournamentModel.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверяем, что пользователь - организатор
        if (tournament.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Только организатор может запустить генерацию сетки' });
        }

        // Закрываем регистрацию, если ещё открыта
        if (tournament.status === 'registration_open') {
            await TournamentModel.updateStatus(tournamentId, 'registration_closed');
        }

        // Получаем одобренные команды
        const teams = await TournamentModel.getApprovedTeams(tournamentId);

        if (teams.length < 2) {
            return res.status(400).json({ error: 'Недостаточно команд для генерации сетки (минимум 2)' });
        }

        // Получаем стратегию в зависимости от формата турнира
        const strategy = BracketGenerator.getStrategy(tournament.format);
        const generator = new BracketGenerator(strategy);
        const matches = generator.generate(teams, tournamentId);

        // Сохраняем матчи в БД
        await MatchModel.createMany(matches);

        // Обновляем статус турнира
        await TournamentModel.updateStatus(tournamentId, 'in_progress');

        // Уведомляем участников
        notificationService.notifyAll('bracket_generated', {
            tournamentId,
            message: 'Турнирная сетка сгенерирована'
        });

        res.json({ message: 'Сетка сгенерирована', matchesCount: matches.length });
    } catch (err) {
        console.error('Ошибка генерации сетки:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.reschedule = async (req, res) => {
  const { newDate } = req.body;
  await TournamentModel.reschedule(req.params.id, newDate);
  notificationService.notifyAll('tournament_rescheduled', { tournamentId: req.params.id, newDate });
  res.json({ message: 'Rescheduled' });
};