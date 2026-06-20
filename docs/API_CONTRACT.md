# API Contract — Inventory Rental Backend

Базовый префикс всех контроллеров: `/api`.
Авторизация: cookie `token` (JWT access). Роли: `renter`, `business`, `admin`.

Гард `CookieAuthGuard` требует валидную cookie. `RolesGuard` + `@Roles('admin')` —
доступ только администратору. ValidationPipe работает в режиме
`whitelist + forbidNonWhitelisted`: **неизвестные поля тела отклоняются (400)**.

Общий формат ошибок NestJS:
```json
{ "statusCode": 400, "message": "текст или массив сообщений", "error": "Bad Request" }
```

Статическая раздача файлов (fallback-режим хранилища): `GET /uploads/<path>` (вне `/api`).

---

## 1. Категории

### GET /api/category/visible — без авторизации
Видимые категории, отсортированы по `order`, затем `name`.
Ответ: `{ "categories": Category[] }`

### GET /api/category/all — без авторизации
Все категории (видимые и скрытые), сортировка по `order`, `name`.
Ответ: `{ "categories": Category[] }`

`Category`:
```json
{ "_id": "string", "key": "string", "name": "string", "isVisible": true, "icon": "string?", "order": 0 }
```

### POST /api/category/create — admin
Тело:
```json
{ "key": "sport", "name": "Спорт", "isVisible": true, "icon": "string?", "order": 0 }
```
`key`, `name` — обязательны (min 2). `isVisible`, `icon`, `order` — опциональны.
Ответ: `{ "category": Category }`

### PATCH /api/category/:id — admin
Частичное обновление. Тело (любое подмножество):
```json
{ "name": "string?", "icon": "string?", "order": 0, "isVisible": true }
```
Ответ: `{ "category": Category }` · Ошибки: 404 (нет категории).

### PATCH /api/category/:id/visibility — admin
Переключение видимости. Тело (опционально):
```json
{ "isVisible": true }
```
Если `isVisible` не передан — значение инвертируется.
Ответ: `{ "category": Category }` · Ошибки: 404.

### DELETE /api/category/:id — admin
Ответ: `{ "deleted": true }` · Ошибки: 404.

### POST /api/category/seed-defaults — admin
Создаёт дефолтные категории (идемпотентно). Ответ: `{ "categories": Category[] }`

### GET /api/categories?isActive=true — без авторизации (публичный формат)
Ответ:
```json
{ "data": [ { "id": "string", "title": "string", "slug": "string", "icon": "string?", "sortOrder": 0, "isActive": true } ] }
```

---

## 2. Объявления (rental-listing)

### POST /api/rental-listing/catalog — без авторизации
Каталог с фильтрами и пагинацией. Тело:
```json
{
  "page": 1,
  "limit": 12,
  "filters": {
    "categories": ["sport"],
    "search": "палатка",
    "dateFrom": "2026-07-01",
    "dateTo": "2026-07-05",
    "priceFrom": 0,
    "priceTo": 1000,
    "unitsNeeded": 1,
    "pickupType": "pickup|delivery|both",
    "sortBy": "priceAsc|priceDesc"
  }
}
```
**Фильтр по датам (`dateFrom`/`dateTo`)**: исключаются листинги, у которых в этом
диапазоне свободно меньше `unitsNeeded` единиц (учёт занятости по units и активным броням).
Ответ: `{ "data": Listing[], "total": n, "page": n, "totalPages": n }`

### POST /api/rental-listing/create — business | admin
Тело:
```json
{
  "title": "string", "description": "string",
  "categories": ["sport"], "photos": ["https://..."],
  "pricePerDay": 500, "minDays": 1, "unitsTotal": 3,
  "pickupType": "pickup|delivery|both",
  "pickupAddress": "string?", "deliveryZone": "string?",
  "calendar": [{ "from": "2026-07-01", "to": "2026-07-10" }],
  "asDraft": false
}
```
`asDraft: true` — сохранить черновиком (`moderationStatus=draft`), иначе `pending`.
Ответ: `{ "listing": Listing }` · Ошибки: 403 (не арендодатель).

### GET /api/rental-listing/my — авторизованный
Объявления текущего пользователя. Ответ: `{ "listings": Listing[] }`

### POST /api/rental-listing/moderation — admin
Универсальная смена статуса модерации. Тело:
```json
{ "listingId": "string", "status": "draft|active|pending|rejected|hidden", "rejectionReason": "string?" }
```
При `status=rejected` сохраняется `rejectionReason` (или `reason`).
Ответ: `{ "listing": Listing }`

### POST /api/rental-listing/:id/submit-moderation — владелец
Перевод `draft|rejected` → `pending`. Сбрасывает `rejectionReason`.
Ответ: `{ "listing": Listing }` · Ошибки: 403 (не владелец), 404.

### PATCH /api/rental-listing/:id — владелец
Частичное редактирование объявления. Тело (любое подмножество полей create,
без `asDraft`):
```json
{ "title": "string?", "description": "string?", "categories": ["sport"], "photos": ["https://..."],
  "pricePerDay": 500, "minDays": 1, "unitsTotal": 3,
  "pickupType": "pickup|delivery|both", "pickupAddress": "string?", "deliveryZone": "string?",
  "calendar": [{ "from": "...", "to": "..." }] }
```
Правка объявления в статусе `active|hidden` возвращает его на модерацию (`pending`).
`unitsAvailable` синхронизируется с `unitsTotal`. Ответ: `{ "listing": Listing }` · Ошибки: 403, 404.

### POST /api/rental-listing/:id/visibility — владелец
Скрыть/показать объявление. Тело: `{ "hidden": true }`.
`hidden:true` — `active`→`hidden`; `hidden:false` — `hidden`→`active`.
Ответ: `{ "listing": Listing }` · Ошибки: 403 (недопустимый статус / не владелец), 404.

### DELETE /api/rental-listing/:id — владелец
Удаление своего объявления. Ответ: `{ "deleted": true }` · Ошибки: 403, 404.

### GET /api/rental-listing/:id — без авторизации
Ответ: `{ "listing": Listing }` · Ошибки: 404.

`Listing` (ключевые поля):
```json
{
  "_id": "string", "title": "string", "description": "string",
  "categories": ["sport"], "photos": ["https://..."],
  "pricePerDay": 500, "minDays": 1, "unitsTotal": 3, "unitsAvailable": 3,
  "pickupType": "pickup", "pickupAddress": "string?", "deliveryZone": "string?",
  "moderationStatus": "draft|active|pending|rejected|hidden",
  "rejectionReason": "string?",
  "ownerId": { "_id": "string", "fullName": "string", "phone": "string", ... }
}
```

### Публичный формат: GET /api/listings, GET /api/listings/:id
Статусы мапятся: `pending`→`moderation`, `draft`→`draft`, прочее без изменений.

---

## 3. Бронирование (booking)

### POST /api/booking/create — renter | admin
Тело:
```json
{ "listingId": "ObjectId", "dateFrom": "2026-07-01", "dateTo": "2026-07-05", "units": 2, "acceptedPersonalData": true }
```
Действия: проверка доступности, расчёт суммы, **генерация 2 PDF-договоров** и сохранение
ссылок. Ответ:
```json
{
  "bookingId": "string", "status": "pending",
  "days": 4, "pricePerDay": 500, "totalPrice": 4000, "agentCommission": 0,
  "rentalAgreementPdfUrl": "https://.../contracts/rental-...pdf",
  "agencyAgreementPdfUrl": "https://.../contracts/agency-...pdf"
}
```
Ошибки: 400 (нет согласия / нет доступных единиц / некорректный период / PDF не сформирован), 403.

### GET /api/booking/my — авторизованный
Брони текущего пользователя (как арендатора). Ответ: `{ "bookings": Booking[] }`

### GET /api/booking/owner — авторизованный
Брони по объявлениям текущего арендодателя. Ответ: `{ "bookings": Booking[] }`

### PATCH /api/booking/:id/status — участник сделки / admin
Ручная смена статуса. Тело:
```json
{ "status": "pending|confirmed|active|completed|cancelled" }
```
Разрешённые переходы: `pending→confirmed|cancelled`, `confirmed→active|cancelled`,
`active→completed|cancelled`. `completed`/`cancelled` — финальные.
Правила прав: `cancelled` — арендатор или владелец; `confirmed/active/completed` — только владелец; admin — всё.
Ответ: `{ "booking": Booking }` · Ошибки: 400 (недопустимый переход), 403, 404.

### POST /api/booking/:id/pay — арендатор / admin (ЗАГЛУШКА оплаты)
Перевод `pending` → `confirmed` (реальный эквайринг позже).
Ответ: `{ "bookingId": "string", "status": "confirmed", "paid": true }` · Ошибки: 400, 403, 404.

### GET /api/booking/:id/contracts — участник сделки / admin
Ссылки на договоры. Ответ:
```json
{ "rentalAgreementPdfUrl": "https://...", "agencyAgreementPdfUrl": "https://..." }
```
Ошибки: 403 (не участник), 404.

### GET /api/booking/busy/:listingId — без авторизации
Занятые диапазоны (статусы pending/confirmed/active). Ответ:
```json
{ "busyRanges": [ { "bookingId": "string", "dateFrom": "...", "dateTo": "...", "status": "pending", "units": 2 } ] }
```

`Booking`:
```json
{
  "_id": "string", "listingId": {...}, "renterId": {...},
  "dateFrom": "2026-07-01", "dateTo": "2026-07-05", "units": 2,
  "days": 4, "pricePerDay": 500, "totalPrice": 4000, "agentCommission": 0,
  "status": "pending|confirmed|active|completed|cancelled",
  "rentalAgreementPdfUrl": "string", "agencyAgreementPdfUrl": "string"
}
```

---

## 4. Загрузка файлов (upload)

### POST /api/upload/photos — авторизованный
`multipart/form-data`, поле `files` — до 5 изображений (jpeg/png/webp/gif), ≤ 8 МБ каждый.
Хранилище: Yandex Object Storage при наличии ключей, иначе локально (`/uploads`).
Ответ:
```json
{ "urls": ["https://...", "..."], "storage": "cloud|local" }
```
Ошибки: 400 (нет файлов / >5 / недопустимый тип), 401.

---

## 5. Организация / Верификация (organization)

Все маршруты под `CookieAuthGuard` (авторизованный пользователь).

### GET /api/organization/dadata?inn=7700000000 — авторизованный
Проксирование к DaData по ИНН (10 или 12 цифр). Ответ:
```json
{ "companies": [ { "inn": "string", "ogrn": "string", "name": "string", "shortName": "string?", "address": "string", "kpp": "string|null", "type": "string?", "raw": {} } ] }
```
Ошибки: 400 (некорректный ИНН), 401, 500 (DaData недоступна / нет DADATA_TOKEN).

### GET /api/organization/mine — авторизованный
Ответ: `{ "organization": Organization | null }`

### POST /api/organization/submit-verification — авторизованный
Тело:
```json
{ "legalStatus": "person|ip|ooo", "inn": "string", "ogrnOrOgrnip": "string", "companyName": "string", "payoutPhone": "string" }
```
Ответ: `{ "organization": Organization }`

(Дубли: `GET /api/user/my-organization`, `POST /api/user/submit-organization-verification`.)

---

## 6. Пользователь (user)

### GET /api/user/me — авторизованный → `{ "user": User|null }` (без password)
### POST /api/user/update — авторизованный
### POST /api/user/verify-renter — авторизованный

---

## 7. Админка (admin) — все @Roles('admin')

### GET /api/admin/dashboard
Ответ: `{ "categoriesCount": n, "usersCount": n, "listingsStats": { "active": n, "pending": n, "rejected": n, "hidden": n } }`

### GET /api/admin/listings
Превью листингов: `{ "data": Listing[], "total": n, "page": 1, "totalPages": 1 }`

### Модерация листингов
- `POST /api/admin/listings/:id/approve` → `{ "listing": Listing }` (status=active)
- `POST /api/admin/listings/:id/reject` тело `{ "rejectionReason": "string?" }` → `{ "listing": Listing }` (status=rejected, сохраняется причина)
- `POST /api/admin/listings/:id/hide` → `{ "listing": Listing }` (status=hidden)
- `DELETE /api/admin/listings/:id` → `{ "deleted": true }` · Ошибки 404

### Пользователи
- `GET /api/admin/users?role=renter|business|admin&verification=pending|approved|rejected|none`
  Ответ:
  ```json
  {
    "users": [ {
      "id": "string", "fullName": "string", "email": "string", "phone": "string",
      "roles": ["renter"], "isBlocked": false, "isRenterVerified": true,
      "organizationStatus": "pending|approved|rejected|none",
      "listingsCount": 0, "bookingsCount": 0, "createdAt": "ISO?"
    } ],
    "total": n
  }
  ```
  Пароль/токены не возвращаются. Фильтры опциональны.
- `PATCH /api/admin/users/:id/blocked` тело `{ "isBlocked": true }`
  Ответ: `{ "user": { "id", "fullName", "email", "phone", "roles", "isBlocked", "isRenterVerified" } }` · Ошибки 404

### Организации (без изменений)
- `GET /api/admin/organization-verification-requests`
- `POST /api/admin/organization-verification/approve` тело `{ "organizationId": "string", "comment": "string?" }`
- `POST /api/admin/organization-verification/reject` тело `{ "organizationId": "string", "comment": "string?" }`

---

## Переменные окружения (см. .env.example)

| Переменная | Назначение |
|---|---|
| `PUBLIC_API_URL` | Внешний URL API для ссылок на локальные файлы (fallback) |
| `YANDEX_S3_ENDPOINT` / `YANDEX_S3_REGION` / `YANDEX_S3_BUCKET` / `YANDEX_S3_ACCESS_KEY` / `YANDEX_S3_SECRET_KEY` | Yandex Object Storage. Если не заданы все ключи — локальный fallback |
| `DADATA_TOKEN` | Токен DaData для `/organization/dadata` |
| `AGENT_NAME` / `AGENT_INN` / `AGENT_OGRN` / `AGENT_ADDRESS` / `AGENT_PHONE` | Реквизиты ИП-владельца платформы (агентский договор) |
| `AGENT_COMMISSION_PERCENT` | Процент агентской комиссии (резерв, по умолчанию 0) |
