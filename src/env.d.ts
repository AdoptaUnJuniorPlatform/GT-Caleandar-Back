/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_API_KEY: string;
  readonly PUBLIC_AUTH_DOMAIN: string;
  readonly PUBLIC_DATABASE_URL: string;
  readonly PUBLIC_PROJECT_ID: string;
  readonly PUBLIC_STORAGE_BUCKET: string;
  readonly PUBLIC_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_APP_ID: string;
  readonly PUBLIC_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
