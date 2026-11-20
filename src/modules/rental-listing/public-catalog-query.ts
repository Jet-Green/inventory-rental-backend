import { BadRequestException } from '@nestjs/common';

export function validatePublicCatalogQuery(query: Record<string, unknown>) {
  if (query.categorySlugs !== undefined) {
    const values = Array.isArray(query.categorySlugs) ? query.categorySlugs : [query.categorySlugs];
    if (values.length > 50 || values.some(value => typeof value !== 'string' || value.length > 500)) throw new BadRequestException('Некорректные категории');
  }
  for (const key of ['page', 'limit', 'priceFrom', 'priceTo', 'unitsNeeded']) {
    const value = query[key];
    if (value === undefined) continue;
    const number = Number(value);
    if (typeof value !== 'string' || !value.trim() || !Number.isFinite(number) ||
      number < (key === 'priceFrom' || key === 'priceTo' ? 0 : 1) ||
      (['page', 'limit', 'unitsNeeded'].includes(key) && !Number.isSafeInteger(number)) ||
      (key === 'limit' && number > 48)) {
      throw new BadRequestException(`Некорректный параметр ${key}`);
    }
  }
  if (query.priceFrom !== undefined && query.priceTo !== undefined && Number(query.priceFrom) > Number(query.priceTo)) {
    throw new BadRequestException('Минимальная цена превышает максимальную');
  }
  for (const [key, allowed] of [['pickupMethod', ['self_pickup', 'delivery']], ['sortBy', ['priceAsc', 'priceDesc']]] as const) {
    if (query[key] !== undefined && !allowed.includes(query[key] as never)) throw new BadRequestException(`Некорректный параметр ${key}`);
  }
  if (query.dateFrom !== undefined || query.dateTo !== undefined) {
    const valid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!valid(query.dateFrom) || !valid(query.dateTo) || query.dateTo <= query.dateFrom) {
      throw new BadRequestException('Укажите корректный период аренды: dateFrom < dateTo');
    }
  }
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 200)) throw new BadRequestException('Некорректный поиск');
}
