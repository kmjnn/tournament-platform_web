// backend/routes/tournamentRoutes.js
const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const auth = require('../middleware/auth');

// Все маршруты защищены авторизацией
router.use(auth);

// Создать турнир
router.post('/', tournamentController.create);

// Получить все турниры
router.get('/', tournamentController.getAll);

// Получить конкретный турнир
router.get('/:id', tournamentController.getById);

// Подать заявку на турнир
router.post('/:id/register', tournamentController.register);

// Получить заявки (для организатора)
router.get('/:id/requests', tournamentController.getRequests);

// Получить статус заявок текущего пользователя (НОВЫЙ МАРШРУТ)
router.get('/:id/my-requests', tournamentController.getMyRequests);

// Одобрить заявку
router.put('/requests/:requestId/approve', tournamentController.approveRequest);

// Отклонить заявку
router.put('/requests/:requestId/reject', tournamentController.rejectRequest);

// Сгенерировать сетку
router.post('/:id/start-bracket', tournamentController.startBracket);

// Получить матчи турнира
router.get('/:id/matches', tournamentController.getMatches);

// Внести результат матча
router.put('/matches/result', tournamentController.updateMatchResult);

module.exports = router;