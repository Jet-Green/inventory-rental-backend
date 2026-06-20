import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { extname, join } from "path";
import { Injectable, Logger } from "@nestjs/common";
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Универсальное хранилище файлов.
 *
 * Если в env заданы ключи Yandex Object Storage (S3-совместимое) — файлы
 * загружаются в облако и возвращается публичный URL бакета.
 * Иначе — fallback на локальную папку `uploads/` со статической раздачей
 * (см. ServeStaticModule в app.module.ts). Переключение режима — только через env.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicBaseUrl: string;

  /** Корневая папка локального хранилища (используется в fallback-режиме). */
  static readonly LOCAL_ROOT = join(process.cwd(), "uploads");

  constructor() {
    this.endpoint =
      process.env.YANDEX_S3_ENDPOINT || "https://storage.yandexcloud.net";
    this.bucket = process.env.YANDEX_S3_BUCKET || "";
    const accessKeyId = process.env.YANDEX_S3_ACCESS_KEY || "";
    const secretAccessKey = process.env.YANDEX_S3_SECRET_KEY || "";
    const region = process.env.YANDEX_S3_REGION || "ru-central1";

    // S3 включается только при наличии всех обязательных ключей.
    if (this.bucket && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint: this.endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: false,
      });
      this.publicBaseUrl = `${this.endpoint.replace(/\/+$/, "")}/${this.bucket}`;
      this.logger.log("StorageService: режим Yandex Object Storage (S3)");
    } else {
      this.s3Client = null;
      // Базовый URL для локальной раздачи. PUBLIC_API_URL — внешний адрес сервера.
      const apiUrl = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
      this.publicBaseUrl = apiUrl ? `${apiUrl}/uploads` : "/uploads";
      this.logger.warn(
        "StorageService: режим локального хранилища (uploads/). Ключи Yandex S3 не заданы.",
      );
    }
  }

  /** Включён ли облачный режим. */
  isCloudEnabled(): boolean {
    return this.s3Client !== null;
  }

  /**
   * Сохраняет произвольный буфер. `folder` — логическая папка
   * (напр. "listings" или "contracts"). Возвращает публичный URL.
   */
  async upload(params: {
    buffer: Buffer;
    folder: string;
    originalName?: string;
    contentType: string;
  }): Promise<{ url: string; key: string }> {
    const ext = this.resolveExt(params.originalName, params.contentType);
    const key = `${this.sanitizeFolder(params.folder)}/${randomUUID()}${ext}`;

    if (this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.buffer,
          ContentType: params.contentType,
          ACL: "public-read",
        }),
      );
      return { url: `${this.publicBaseUrl}/${key}`, key };
    }

    // Fallback: локальная файловая система.
    const absDir = join(StorageService.LOCAL_ROOT, this.sanitizeFolder(params.folder));
    if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true });
    const fileName = key.split("/").pop() as string;
    await writeFile(join(absDir, fileName), params.buffer);
    return { url: `${this.publicBaseUrl}/${key}`, key };
  }

  /** Защита от path traversal в имени папки. */
  private sanitizeFolder(folder: string): string {
    return (folder || "misc").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "misc";
  }

  private resolveExt(originalName: string | undefined, contentType: string): string {
    const fromName = originalName ? extname(originalName).toLowerCase() : "";
    if (fromName && /^\.[a-z0-9]{1,5}$/.test(fromName)) return fromName;
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "application/pdf": ".pdf",
    };
    return map[contentType] || "";
  }
}
