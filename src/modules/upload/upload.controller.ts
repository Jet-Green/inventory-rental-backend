import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { StorageService } from "../../common/storage/storage.service";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 МБ на файл
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Загрузка фотографий объявлений (до 5 шт.). Только для авторизованных. */
@Controller("upload")
@UseGuards(CookieAuthGuard)
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post("photos")
  @UseInterceptors(
    FilesInterceptor("files", MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    }),
  )
  async uploadPhotos(
    @UploadedFiles() files: Array<Express.Multer.File>,
  ): Promise<{ urls: string[]; storage: "cloud" | "local" }> {
    if (!files?.length) {
      throw new BadRequestException("Не переданы файлы");
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`Максимум ${MAX_FILES} файлов`);
    }

    // Валидация типов — защита от загрузки произвольных файлов.
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        throw new BadRequestException(
          `Недопустимый тип файла: ${file.mimetype}. Разрешены изображения.`,
        );
      }
    }

    const uploaded = await Promise.all(
      files.map((file) =>
        this.storageService.upload({
          buffer: file.buffer,
          folder: "listings",
          originalName: file.originalname,
          contentType: file.mimetype,
        }),
      ),
    );

    return {
      urls: uploaded.map((u) => u.url),
      storage: this.storageService.isCloudEnabled() ? "cloud" : "local",
    };
  }
}
