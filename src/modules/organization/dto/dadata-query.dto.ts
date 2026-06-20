import { IsString, Matches } from "class-validator";

export class DadataQueryDto {
  /** ИНН: 10 цифр (юрлицо) или 12 (ИП/физлицо). */
  @IsString()
  @Matches(/^\d{10}$|^\d{12}$/, {
    message: "Некорректный ИНН (ожидается 10 или 12 цифр)",
  })
  inn: string;
}
