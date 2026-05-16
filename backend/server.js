require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const authController = require('./controllers/authController');
const tournamentController = require('./controllers/tournamentController');
const matchController = require('./controllers/matchController');
const authMiddleware = require('./middleware/auth');
const notificationService = require('./services/notificationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Раздача статических файлов фронтенда (из папки ../frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// WebSocket подключение
io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`);
  });
});
const TournamentModel = require('./models/tournamentModel');
app.get('/api/tournaments/:id/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await TournamentModel.getRequests(req.params.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
notificationService.setSocketIO(io);

// Маршруты API
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

app.get('/api/tournaments', tournamentController.list);
app.get('/api/tournaments/:id', tournamentController.get);
app.post('/api/tournaments', authMiddleware, tournamentController.create);
app.post('/api/tournaments/:id/register', authMiddleware, tournamentController.register);
app.put('/api/requests/:requestId/approve', authMiddleware, tournamentController.approveRequest);
app.put('/api/requests/:requestId/reject', authMiddleware, tournamentController.rejectRequest);
app.post('/api/tournaments/:id/start-bracket', authMiddleware, tournamentController.startBracket);
app.put('/api/tournaments/:id/reschedule', authMiddleware, tournamentController.reschedule);

app.put('/api/matches/result', authMiddleware, matchController.updateResult);

// Дополнительный endpoint для получения матчей турнира (используется на фронте)
const MatchModel = require('./models/matchModel');
app.get('/api/tournaments/:id/matches', async (req, res) => {
  try {
    const matches = await MatchModel.findByTournament(req.params.id);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/tournaments/:id/teams', async (req, res) => {
  try {
    const teams = await TournamentModel.getApprovedTeams(req.params.id);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));