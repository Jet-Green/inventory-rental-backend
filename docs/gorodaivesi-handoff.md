# Переход из ГиВ в Аренду

Реализовано локально 20.11.2026; не является подтверждением выката.

Оба backend требуют одинаковый `RENTAL_HANDOFF_SECRET` длиной не менее 32 символов. Значение хранить только в окружении; не использовать JWT secrets. URL источников зафиксированы на HTTPS gorodaivesi.ru и rent.gorodaivesi.ru. В окружении аренды должны быть корректны HTTPS=true, DOMAIN и разрешённый CLIENT_URLS для витрины.

1. CTA ГиВ открывает `/auth/gorodaivesi?listingId=<id>` на витрине Аренды.
2. POST `/api/auth/gorodaivesi/start` создаёт HttpOnly host-only cookie на API (5 минут) и возвращает URL `/rental/auth?listingId=...&state=...` ГиВ.
3. После входа на ГиВ POST `/auth/rental-handoff` создаёт код на 60 секунд (в Mongo хранится SHA-256); URL callback содержит код во фрагменте, без access/refresh tokens.
4. Callback убирает fragment из history и POST `/api/auth/gorodaivesi/complete` проверяет browser cookie до обмена.
5. Backchannel POST `/auth/rental-handoff/exchange` на ГиВ проверяет общий секрет и атомарно забирает неистёкший код с тем же state. Автоматического retry нет: при неопределённом ответе нужен новый переход.
6. Связь пользователя только по паре gorodaivesi+externalId. Совпадение email с локальным аккаунтом отклоняется; пользователь входит в существующий аккаунт Аренды и возвращается к объекту. Email ГиВ не считается подтверждённым идентификатором. Роли ADMIN_EMAILS не применяются к внешнему входу; существующие роли сохраняются, blocked отвергается.

Перед выкатом проверить наличие дублей пары externalProvider/externalId: схема добавляет unique partial index и нельзя автоматически объединять старые аккаунты. Пустой телефон допустим для внешнего профиля; номер не подставляется искусственно.

Локальные проверки: `npm run build`; `node --test test/handoff.test.cjs`. Тест ГиВ: `node --test test/rental-handoff.test.js`. Моки не обращаются к боевым API/БД, не создают брони и не двигают деньги. Межсервисный browser flow требует отдельной сквозной проверки.
