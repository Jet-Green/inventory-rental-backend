# Inventory Rental Backend

NestJS + Mongoose backend для сервиса аренды инвентаря.

## Что уже реализовано

- Базовая инфраструктура:
  - MongoDB подключение через `MongooseModule`,
  - throttling по IP (`@nestjs/throttler`),
  - глобальная валидация DTO.
- Модули:
  - `auth` (локальная авторизация: registration/login/refresh/logout),
  - `user`,
  - `category` (видимые/все/создание),
  - `rental-listing` (каталог + карточка объявления),
  - `booking` (создание брони + генерация ссылок на договоры),
  - `admin` (dashboard + preview объявлений).

## Запуск

```bash
npm i
npm run dev
```

1. Скопируйте `.env.example` в `.env` (или используйте уже созданный `.env`).
2. Запустите MongoDB локально.
3. Проверьте, что `CLIENT_URL` совпадает с URL фронтенда.

Переменные окружения:

- `PORT` (по умолчанию `4000`)
- `MONGO_URL` (по умолчанию `mongodb://localhost:27017/inventory-rental`)
- `CLIENT_URL` (по умолчанию `http://localhost:3068`)
- `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET`
- `ADMIN_EMAILS` (CSV email-адресов, которым автоматически назначается роль `admin`)
