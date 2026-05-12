import * as dotenv from "dotenv";
import * as path from "path";

// NODE_ENV=testnet → .env.testnet；其余均用 .env
const envFile = process.env.NODE_ENV === "testnet" ? ".env.testnet" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
