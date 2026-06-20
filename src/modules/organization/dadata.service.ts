import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

const DADATA_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

export interface DadataCompany {
  inn: string;
  ogrn: string;
  name: string;
  shortName?: string;
  address: string;
  kpp?: string | null;
  type?: string;
  raw: any;
}

/** Интеграция с DaData: получение данных организации/ИП по ИНН. */
@Injectable()
export class DadataService {
  private readonly logger = new Logger(DadataService.name);

  async findByInn(inn: string): Promise<DadataCompany[]> {
    const token = process.env.DADATA_TOKEN;
    if (!token) {
      throw new InternalServerErrorException(
        "DaData не настроена: отсутствует DADATA_TOKEN",
      );
    }
    const normalized = (inn || "").trim();
    // ИНН: 10 (юрлицо) или 12 (ИП/физлицо) цифр.
    if (!/^\d{10}$|^\d{12}$/.test(normalized)) {
      throw new BadRequestException("Некорректный ИНН (ожидается 10 или 12 цифр)");
    }

    let response: Response;
    try {
      response = await fetch(DADATA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ query: normalized }),
      });
    } catch (err) {
      this.logger.error(`DaData запрос не выполнен: ${(err as Error).message}`);
      throw new InternalServerErrorException("Сервис DaData недоступен");
    }

    if (!response.ok) {
      this.logger.error(`DaData ответил кодом ${response.status}`);
      throw new InternalServerErrorException(
        `Ошибка DaData (HTTP ${response.status})`,
      );
    }

    const json = (await response.json()) as { suggestions?: any[] };
    const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];

    return suggestions.map((s) => {
      const data = s?.data || {};
      return {
        inn: data.inn,
        ogrn: data.ogrn,
        name: data?.name?.full_with_opf || s?.value || "",
        shortName: data?.name?.short_with_opf,
        address: data?.address?.value || "",
        kpp: data?.kpp ?? null,
        type: data?.type,
        raw: data,
      };
    });
  }
}
