# Tournament Platform

MVP-платформа для организации спортивных и киберспортивных турниров.

## Стек

- Backend: Node.js, Express, PostgreSQL
- Frontend: React (Vite)
- Infra: Docker Compose

## Быстрый старт

1. Запустить БД:

```bash
docker compose up -d db
```

2. Установить зависимости:

```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Запустить backend:

```bash
cd backend
npm run dev
```

4. Запустить frontend:

```bash
cd frontend
npm run dev
```

## Основные сценарии MVP

- Регистрация и вход (`organizer`, `participant`)
- Создание турнира организатором
- Просмотр списка турниров
- Подача заявки на турнир (solo / team)
- Управление заявками организатором (approve/reject)
- Перенос турнира
- Генерация сетки и матчей (single elimination)
- Внесение результатов матчей

## Переменные окружения backend

Создайте файл `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tournament_platform
JWT_SECRET=dev_secret
```
