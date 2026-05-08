import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("2h"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  ADMIN_TELEGRAM_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  WITHDRAW_MANUAL_REVIEW_THRESHOLD: z.string().default("1000"),
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
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function env(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
