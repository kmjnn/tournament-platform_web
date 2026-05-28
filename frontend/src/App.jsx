import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const emptyTournament = {
  title: "",
  description: "",
  game: "",
  type: "esports",
  format: "single_elim",
  minTeams: 2,
  maxTeams: 16,
  registrationDeadline: "",
  startDate: ""
};

const emptyTeamDraft = { tournamentId: null, teamName: "" };
const emptyRescheduleDraft = { tournamentId: null, registrationDeadline: "", startDate: "" };
const emptyResultDraft = { matchId: null, score1: "", score2: "" };

const statusRu = {
  registration_open: "Регистрация открыта",
  scheduled: "Запланирован",
  in_progress: "Идет",
  finished: "Завершен",
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
  live: "В эфире"
};

const formatRu = {
  single_elim: "Одиночное выбывание",
  double_elim: "Двойное выбывание",
  round_robin: "Круговая система"
};

const BRACKET_MVP_NOTE =
  "В текущей версии (MVP) автоматическая генерация турнирной сетки поддерживается только для формата «Одиночное выбывание».";

function toLocalInputDate(date) {
  const value = new Date(date);
  const pad = (part) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes()
  )}`;
}

function getStatusRu(status) {
  return statusRu[status] || status;
}

function getFormatRu(format) {
  return formatRu[format] || format;
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({ nickname: "", email: "", password: "", role: "participant" });
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [tournaments, setTournaments] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [tournamentForm, setTournamentForm] = useState(() => {
    const now = new Date();
    const registration = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const start = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return {
      ...emptyTournament,
      registrationDeadline: toLocalInputDate(registration),
      startDate: toLocalInputDate(start)
    };
  });
  const [requestsByTournament, setRequestsByTournament] = useState({});
  const [detailsByTournament, setDetailsByTournament] = useState({});
  const [loadingByTournament, setLoadingByTournament] = useState({});
  const [teamModal, setTeamModal] = useState(emptyTeamDraft);
  const [rescheduleModal, setRescheduleModal] = useState(emptyRescheduleDraft);
  const [resultModal, setResultModal] = useState(emptyResultDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeModals = useMemo(
    () => ({
      team: teamModal.tournamentId !== null,
      reschedule: rescheduleModal.tournamentId !== null,
      result: resultModal.matchId !== null
    }),
    [teamModal, rescheduleModal, resultModal]
  );

  async function loadTournaments() {
    const data = await api("/tournaments");
    setTournaments(data);
  }

  async function loadMyRequests(currentToken) {
    const data = await api("/teams/my-requests", {}, currentToken ?? token);
    setMyRequests(data);
  }

  useEffect(() => {
    loadTournaments().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!token) {
      setMyRequests([]);
      return;
    }
    loadMyRequests(token).catch((e) => setError(e.message));
  }, [token]);

  async function onAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (authMode === "register") {
        await api("/auth/register", { method: "POST", body: JSON.stringify(authData) });
        setMessage("Регистрация успешна. Войдите в аккаунт.");
        setAuthMode("login");
        return;
      }

      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authData.email, password: authData.password })
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("tp_auth", JSON.stringify({ token: data.token, user: data.user }));
      setMessage(`Вы вошли как ${data.user.nickname}`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("tp_auth");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.token && parsed?.user) {
        setToken(parsed.token);
        setUser(parsed.user);
      }
    } catch {
      localStorage.removeItem("tp_auth");
    }
  }, []);

  async function createTournament(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/tournaments", { method: "POST", body: JSON.stringify(tournamentForm) }, token);
      await loadTournaments();
      setMessage("Турнир успешно создан");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function applySolo(tournamentId) {
    try {
      await api(
        "/teams/requests",
        {
          method: "POST",
          body: JSON.stringify({ tournamentId, mode: "solo", lookingForTeam: true })
        },
        token
      );
      setMessage("Заявка в одиночку отправлена");
      await loadMyRequests(token);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitTeamApply(event) {
    event.preventDefault();
    if (!teamModal.tournamentId) return;

    try {
      const team = await api(
        "/teams",
        {
          method: "POST",
          body: JSON.stringify({ name: teamModal.teamName, tournamentId: teamModal.tournamentId })
        },
        token
      );
      await api(
        "/teams/requests",
        {
          method: "POST",
          body: JSON.stringify({
            tournamentId: teamModal.tournamentId,
            teamId: team.id,
            mode: "team",
            lookingForTeam: false
          })
        },
        token
      );
      setMessage("Команда создана, заявка отправлена");
      setTeamModal(emptyTeamDraft);
      await loadMyRequests(token);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function logout() {
    setUser(null);
    setToken("");
    localStorage.removeItem("tp_auth");
    setMessage("Вы вышли из аккаунта");
  }

  async function loadDetails(tournamentId) {
    setLoadingByTournament((prev) => ({ ...prev, [tournamentId]: true }));
    try {
      const data = await api(`/tournaments/${tournamentId}`, {}, token);
      setDetailsByTournament((prev) => ({ ...prev, [tournamentId]: data }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingByTournament((prev) => ({ ...prev, [tournamentId]: false }));
    }
  }

  async function loadRequests(tournamentId) {
    try {
      const rows = await api(`/teams/tournaments/${tournamentId}/requests`, {}, token);
      setRequestsByTournament((prev) => ({ ...prev, [tournamentId]: rows }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function setRequestStatus(requestId, status, tournamentId) {
    try {
      await api(`/teams/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
      await loadRequests(tournamentId);
      setMessage(status === "approved" ? "Заявка подтверждена" : "Заявка отклонена");
      await loadMyRequests(token);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function generateBracket(tournamentId) {
    try {
      await api(`/tournaments/${tournamentId}/generate-bracket`, { method: "POST" }, token);
      await Promise.all([loadTournaments(), loadDetails(tournamentId)]);
      setMessage("Сетка матчей создана");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function forceStartTournament(tournamentId) {
    try {
      await api(`/tournaments/${tournamentId}/force-start`, { method: "POST" }, token);
      await Promise.all([loadTournaments(), loadDetails(tournamentId)]);
      setMessage("Турнир запущен принудительно");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!rescheduleModal.tournamentId) return;

    try {
      await api(
        `/tournaments/${rescheduleModal.tournamentId}/reschedule`,
        {
          method: "POST",
          body: JSON.stringify({
            registrationDeadline: rescheduleModal.registrationDeadline,
            startDate: rescheduleModal.startDate
          })
        },
        token
      );
      await loadTournaments();
      setRescheduleModal(emptyRescheduleDraft);
      setMessage("Турнир перенесен на новую дату");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitMatchResult(event) {
    event.preventDefault();
    if (!resultModal.matchId) return;

    try {
      await api(
        `/matches/${resultModal.matchId}/result`,
        {
          method: "PATCH",
          body: JSON.stringify({
            score1: Number(resultModal.score1),
            score2: Number(resultModal.score2)
          })
        },
        token
      );

      setResultModal(emptyResultDraft);
      const targetTournamentId = Object.entries(detailsByTournament).find(([, details]) =>
        details.matches.some((match) => match.id === resultModal.matchId)
      )?.[0];
      if (targetTournamentId) {
        await loadDetails(targetTournamentId);
      }
      setMessage("Результат матча обновлен");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="app-shell">
      <div className="hero">
        <div>
          <h1>Tournament Platform</h1>
          <p>Организация киберспортивных и спортивных турниров в одном интерфейсе</p>
        </div>
        {user && (
          <div className="user-badge">
            <strong>{user.nickname}</strong>
            <span>{user.role}</span>
            <button className="btn tiny ghost logout-btn" onClick={logout}>
              Выход
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {!user && (
        <section className="panel auth-panel">
          <h2>{authMode === "login" ? "Вход" : "Регистрация"}</h2>
          <form onSubmit={onAuthSubmit} className="form-grid">
            {authMode === "register" && (
              <>
                <label>
                  Никнейм
                  <input
                    required
                    value={authData.nickname}
                    onChange={(event) => setAuthData((prev) => ({ ...prev, nickname: event.target.value }))}
                  />
                </label>
                <label>
                  Роль
                  <select
                    value={authData.role}
                    onChange={(event) => setAuthData((prev) => ({ ...prev, role: event.target.value }))}
                  >
                    <option value="participant">participant</option>
                    <option value="organizer">organizer</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Email
              <input
                required
                type="email"
                value={authData.email}
                onChange={(event) => setAuthData((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Пароль
              <input
                required
                type="password"
                value={authData.password}
                onChange={(event) => setAuthData((prev) => ({ ...prev, password: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn primary">
              {authMode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>
          <button className="btn ghost" onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}>
            {authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          </button>
        </section>
      )}

      {user?.role === "organizer" && (
        <section className="panel">
          <h2>Создание турнира</h2>
          <p className="hint info">{BRACKET_MVP_NOTE}</p>
          <form onSubmit={createTournament} className="form-grid two-columns">
            <label>
              Название турнира
              <input
                required
                placeholder="Например: Универ Лига CS2"
                value={tournamentForm.title}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              Дисциплина
              <input
                required
                placeholder="CS2, Dota 2, Volleyball..."
                value={tournamentForm.game}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, game: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Описание
              <textarea
                rows={3}
                placeholder="Краткие правила и особенности турнира"
                value={tournamentForm.description}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label>
              Тип
              <select
                value={tournamentForm.type}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="esports">Киберспорт</option>
                <option value="sports">Спорт</option>
              </select>
            </label>
            <label>
              Формат
              <select
                value={tournamentForm.format}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, format: event.target.value }))}
              >
                <option value="single_elim">Одиночное выбывание (сетка в MVP)</option>
                <option value="double_elim">Двойное выбывание (сетка позже)</option>
                <option value="round_robin">Круговая система (сетка позже)</option>
              </select>
            </label>
            {tournamentForm.format !== "single_elim" && (
              <p className="hint warn full-width">
                Для выбранного формата кнопка «Сгенерировать сетку» недоступна — в MVP поддерживается только одиночное
                выбывание.
              </p>
            )}
            <label>
              Минимум команд
              <input
                min={2}
                type="number"
                value={tournamentForm.minTeams}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, minTeams: Number(event.target.value) }))}
              />
            </label>
            <label>
              Максимум команд
              <input
                min={2}
                type="number"
                value={tournamentForm.maxTeams}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, maxTeams: Number(event.target.value) }))}
              />
            </label>
            <label>
              Дедлайн регистрации
              <input
                required
                type="datetime-local"
                value={tournamentForm.registrationDeadline}
                onChange={(event) =>
                  setTournamentForm((prev) => ({ ...prev, registrationDeadline: event.target.value }))
                }
              />
            </label>
            <label>
              Старт турнира
              <input
                required
                type="datetime-local"
                value={tournamentForm.startDate}
                onChange={(event) => setTournamentForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn primary full-width">
              Опубликовать турнир
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="section-title">Турниры</h2>
        <div className="tournament-grid">
          {tournaments.map((tournament) => (
            <article key={tournament.id} className="panel tournament-card">
              {(() => {
                const isOrganizer = user?.role === "organizer";
                const isParticipant = user?.role === "participant";
                const isRegistrationOpen = tournament.status === "registration_open";
                const isSingleElim = tournament.format === "single_elim";
                const registrationClosed = new Date() >= new Date(tournament.registration_deadline);
                const canGenerateBracket =
                  isOrganizer && isSingleElim && isRegistrationOpen && registrationClosed;
                const canForceStart = isOrganizer && ["registration_open", "scheduled"].includes(tournament.status);
                const canReschedule = isOrganizer && ["registration_open", "scheduled"].includes(tournament.status);
                const canApply = isParticipant && isRegistrationOpen;

                return (
                  <>
              <div className="card-top">
                <h3>{tournament.title}</h3>
                <span className={`status ${tournament.status}`}>{getStatusRu(tournament.status)}</span>
              </div>
              <p className="muted">
                {tournament.game} • {tournament.type} • {getFormatRu(tournament.format)}
              </p>
              {isOrganizer && !isSingleElim && (
                <p className="hint warn">{BRACKET_MVP_NOTE}</p>
              )}
              {isOrganizer && isSingleElim && isRegistrationOpen && !registrationClosed && (
                <p className="hint info">Сетку можно сгенерировать после окончания регистрации.</p>
              )}
              <p className="muted">Организатор: {tournament.organizer}</p>
              <p className="muted">Старт: {new Date(tournament.start_date).toLocaleString()}</p>

              {canApply && (
                <div className="action-row">
                  <button className="btn primary" onClick={() => applySolo(tournament.id)}>
                    Подать заявку solo
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => setTeamModal({ ...emptyTeamDraft, tournamentId: tournament.id })}
                  >
                    Создать команду
                  </button>
                </div>
              )}

              {isOrganizer && (
                <div className="action-row">
                  <button className="btn secondary" onClick={() => loadRequests(tournament.id)}>
                    Заявки
                  </button>
                  {canGenerateBracket && (
                    <button className="btn secondary" onClick={() => generateBracket(tournament.id)}>
                      Сгенерировать сетку
                    </button>
                  )}
                  {isOrganizer && isSingleElim && isRegistrationOpen && !registrationClosed && (
                    <span className="hint inline">Сетка — после дедлайна регистрации</span>
                  )}
                  {canForceStart && (
                    <button className="btn secondary" onClick={() => forceStartTournament(tournament.id)}>
                      Принудительно запустить
                    </button>
                  )}
                  {canReschedule && (
                    <button
                      className="btn secondary"
                      onClick={() =>
                        setRescheduleModal({
                          tournamentId: tournament.id,
                          registrationDeadline: toLocalInputDate(tournament.registration_deadline),
                          startDate: toLocalInputDate(tournament.start_date)
                        })
                      }
                    >
                      Перенести
                    </button>
                  )}
                </div>
              )}

              <button className="btn ghost full-width" onClick={() => loadDetails(tournament.id)}>
                {loadingByTournament[tournament.id] ? "Загрузка..." : "Показать детали"}
              </button>

              {requestsByTournament[tournament.id]?.length > 0 && (
                <div className="subsection">
                  <h4>Заявки</h4>
                  {requestsByTournament[tournament.id].map((request) => (
                    <div key={request.id} className="request-row">
                      <div>
                        <strong>{request.nickname}</strong> ({request.mode}) • {getStatusRu(request.status)}
                      </div>
                      {user?.role === "organizer" && request.status === "pending" && (
                        <div className="action-row compact">
                          <button
                            className="btn tiny primary"
                            onClick={() => setRequestStatus(request.id, "approved", tournament.id)}
                          >
                            Принять
                          </button>
                          <button
                            className="btn tiny danger"
                            onClick={() => setRequestStatus(request.id, "rejected", tournament.id)}
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {detailsByTournament[tournament.id] && (
                <div className="subsection">
                  <h4>Команды ({detailsByTournament[tournament.id].teams.length})</h4>
                  {detailsByTournament[tournament.id].teams.map((team) => (
                    <div key={team.id} className="mini-card">
                      <strong>{team.name}</strong>
                    </div>
                  ))}

                  <h4>Сетка матчей</h4>
                  <BracketView
                    matches={detailsByTournament[tournament.id].matches}
                    canEdit={user?.role === "organizer"}
                    onEnterResult={(matchId) => setResultModal({ matchId, score1: "", score2: "" })}
                  />
                </div>
              )}
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      </section>

      {user?.role === "participant" && (
        <section className="panel">
          <div className="card-top">
            <h3>Мои заявки</h3>
            <button className="btn tiny secondary" onClick={() => loadMyRequests(token)}>
              Обновить
            </button>
          </div>
          {myRequests.length === 0 && <p className="muted">Пока нет заявок на турниры</p>}
          {myRequests.map((request) => (
            <div key={request.id} className="request-row">
              <div>
                <strong>{request.tournament_title}</strong>
                <div className="muted">
                  {request.mode}
                  {request.team_name ? ` • команда: ${request.team_name}` : ""}
                </div>
              </div>
              <span className={`status ${request.status}`}>{getStatusRu(request.status)}</span>
            </div>
          ))}
        </section>
      )}

      {activeModals.team && (
        <Modal title="Создать команду" onClose={() => setTeamModal(emptyTeamDraft)}>
          <form className="form-grid" onSubmit={submitTeamApply}>
            <label>
              Название команды
              <input
                required
                value={teamModal.teamName}
                onChange={(event) => setTeamModal((prev) => ({ ...prev, teamName: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn primary">
              Сохранить и подать заявку
            </button>
          </form>
        </Modal>
      )}

      {activeModals.reschedule && (
        <Modal title="Перенос турнира" onClose={() => setRescheduleModal(emptyRescheduleDraft)}>
          <form className="form-grid" onSubmit={submitReschedule}>
            <label>
              Новый дедлайн регистрации
              <input
                required
                type="datetime-local"
                value={rescheduleModal.registrationDeadline}
                onChange={(event) =>
                  setRescheduleModal((prev) => ({ ...prev, registrationDeadline: event.target.value }))
                }
              />
            </label>
            <label>
              Новая дата старта
              <input
                required
                type="datetime-local"
                value={rescheduleModal.startDate}
                onChange={(event) => setRescheduleModal((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn primary">
              Подтвердить перенос
            </button>
          </form>
        </Modal>
      )}

      {activeModals.result && (
        <Modal title="Результат матча" onClose={() => setResultModal(emptyResultDraft)}>
          <form className="form-grid" onSubmit={submitMatchResult}>
            <label>
              Счет команды 1
              <input
                required
                type="number"
                min={0}
                value={resultModal.score1}
                onChange={(event) => setResultModal((prev) => ({ ...prev, score1: event.target.value }))}
              />
            </label>
            <label>
              Счет команды 2
              <input
                required
                type="number"
                min={0}
                value={resultModal.score2}
                onChange={(event) => setResultModal((prev) => ({ ...prev, score2: event.target.value }))}
              />
            </label>
            <button type="submit" className="btn primary">
              Сохранить
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn tiny ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BracketView({ matches, canEdit, onEnterResult }) {
  const rounds = matches.reduce((acc, match) => {
    const key = String(match.round);
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});

  const orderedRounds = Object.keys(rounds)
    .map((round) => Number(round))
    .sort((a, b) => a - b);

  return (
    <div className="bracket">
      {orderedRounds.map((round) => (
        <div key={round} className="bracket-round">
          <h5>Раунд {round}</h5>
          {rounds[String(round)].map((match) => (
            <div key={match.id} className="bracket-match">
              <div className="bracket-team">
                {match.team1_name}
                <strong>{match.score1 ?? "-"}</strong>
              </div>
              <div className="bracket-team">
                {match.team2_name}
                <strong>{match.score2 ?? "-"}</strong>
              </div>
              <div className="muted">Статус: {getStatusRu(match.status)}</div>
              <div className="winner-label">Победитель: {match.winner_name ?? "—"}</div>
              {canEdit && match.status !== "finished" && (
                <button className="btn tiny secondary" onClick={() => onEnterResult(match.id)}>
                  Внести счет
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
