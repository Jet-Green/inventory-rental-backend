import { Global, Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

/**
 * Глобальный модуль хранилища: сервис доступен в любом модуле без явного импорта.
 * Используется загрузкой фото и генерацией PDF-договоров.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
