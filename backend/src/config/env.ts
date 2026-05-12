import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(7001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("2h"),
  ADMIN_JWT_SECRET: z.string().min(32),
  ADMIN_JWT_EXPIRES_IN: z.string().default("8h"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  ADMIN_BOOTSTRAP_USERNAME: z.string().trim().min(3).optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  ADMIN_BOOTSTRAP_DISPLAY_NAME: z.string().trim().min(1).optional(),
  ADMIN_BOOTSTRAP_ROLE: z.enum(["SUPER_ADMIN", "OPS_REVIEWER", "FINANCE_OPERATOR"]).default("SUPER_ADMIN"),
  WITHDRAW_MANUAL_REVIEW_THRESHOLD: z.string().default("1000"),
  UPLOAD_DIR: z.string().default("./uploads"),
  // TON chain integration
  TONCENTER_API_URL: z.string().url().default("https://toncenter.com/api/v2"),
  TONCENTER_API_KEY: z.string().optional(),
  USDT_JETTON_MASTER_ADDRESS: z
    .string()
    .default("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"), // USDT mainnet
  // Hot wallet for on-chain withdrawals (24-word BIP39 mnemonic, space-separated)
  TON_HOT_WALLET_MNEMONIC: z.string().optional(),
  // TRC20 (Tron) chain integration
  TRONGRID_API_URL: z.string().url().default("https://api.trongrid.io"),
  TRONGRID_API_KEY: z.string().optional(),
  TRC20_USDT_CONTRACT: z.string().default("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"),
  // BIP44 mnemonic for TRC20; index 0 = hot wallet (withdrawals), 1+ = deposit addresses
  TRC20_HOT_WALLET_MNEMONIC: z.string().optional(),
  // Swap fee rates
  SWAP_SPREAD_RATE: z.string().default("0.005"),     // 0.5% spread for asset swaps
  BRIDGE_SPREAD_RATE: z.string().default("0.002"),   // 0.2% spread for bridge
  BRIDGE_FIXED_FEE_USDT: z.string().default("0.5"), // fixed fee in USDT for bridge
  // Fiat on-ramp
  FIAT_CNY_RATE: z.string().default("7.25"),         // CNY per USD
  FIAT_FEE_RATE: z.string().default("0.015"),        // 1.5% platform fee
  FIAT_ORDER_EXPIRE_MINUTES: z.coerce.number().int().positive().default(15),
  // Staking
  STAKING_PLATFORM_FEE_RATE: z.string().default("0.15"),  // 15% of yield
  STAKING_BATCH_MIN_USDT: z.string().default("100"),       // min USDT before on-chain deposit
  JUSTLEND_USDT_MARKET: z.string().optional(),             // JustLend USDT jToken contract address
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function env(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
