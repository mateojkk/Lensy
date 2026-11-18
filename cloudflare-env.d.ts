declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TELEGRAPH_API_KEY?: string;
    LENSY_SPONSOR_ENABLED?: string;
    LENSY_SPONSOR_MAX_CALL_USDC?: string;
    LENSY_SPONSOR_DAILY_USDC?: string;
    LENSY_SPONSOR_CHECKS_PER_USER?: string;
  }
}
