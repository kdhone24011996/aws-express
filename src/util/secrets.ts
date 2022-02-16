import logger from "./logger";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env")) {
  logger.debug("Using .env file to supply config environment variables");
  dotenv.config({ path: ".env" });
} else {
  logger.debug(
    "Using .env.example file to supply config environment variables"
  );
  dotenv.config({ path: ".env.example" }); // you can delete this after you create your own .env file!
}
export const ENVIRONMENT = process.env.NODE_ENV;
const prod = ENVIRONMENT === "production"; // Anything else is treated as 'dev'

export const SESSION_SECRET = process.env.SESSION_SECRET;
export const MONGODB_URI = prod
  ? process.env.MONGODB_URI
  : process.env.MONGODB_URI_LOCAL;

export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
export const AWS_REGION = process.env.AWS_REGION;

export const EMAIL_SENDER = process.env.EMAIL_SENDER;
export const EMAIL_CODE_EXPIRY_HOURS =
  parseInt(process.env.EMAIL_CODE_EXPIRY_HOURS) || 24;
export const EMAIL_CODE_RESEND_WAIT_MIN =
  parseInt(process.env.EMAIL_CODE_RESEND_WAIT_MIN) || 3;
export const EMAIL_CODE_LENGTH = parseInt(process.env.EMAIL_CODE_LENGTH) || 5;
export const EMAIL_CODE_RETRIES = parseInt(process.env.EMAIL_CODE_RETRIES) || 3;

export const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || "60m";
export const TOKEN_REFRESH_EXPIRY = process.env.TOKEN_REFRESH_EXPIRY || "7d";
export const TOKEN_ISSUER = process.env.TOKEN_ISSUER || "boilerplate.io";
export const TOKEN_AUDIENCE = process.env.TOKEN_AUDIENCE || "boilerplate";

export const SHIPRROCKET_TOKEN = process.env.SHIPRROCKET_TOKEN;
export const SHIPRROCKET_CHANNEL_ID = process.env.SHIPRROCKET_CHANNEL_ID;
export const SHIPRROCKET_PRIMARY_PICKUP_LOCATION_ID =
  process.env.SHIPRROCKET_PRIMARY_PICKUP_LOCATION_ID;
export const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
export const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
export const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
export const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
export const CASHFREE_BASE_URL = prod
  ? process.env.CASHFREE_PRODUCTION_URL
  : process.env.CASHFREE_SANDBOX_URL;
export const SHIPRROCKET_WEBHOOK_TOKEN = process.env.SHIPRROCKET_WEBHOOK_TOKEN;
if (!MONGODB_URI) {
  if (prod) {
    logger.error(
      "No mongo connection string. Set MONGODB_URI environment variable."
    );
  } else {
    logger.error(
      "No mongo connection string. Set MONGODB_URI_LOCAL environment variable."
    );
  }
  process.exit(1);
}

if (!AWS_ACCESS_KEY_ID) {
  logger.error("No aws key. Set AWS_ACCESS_KEY_ID environment variable.");
  process.exit(1);
}
if (!AWS_SECRET_ACCESS_KEY) {
  logger.error(
    "No aws secret. Set AWS_SECRET_ACCESS_KEY environment variable."
  );
  process.exit(1);
}
if (!AWS_REGION) {
  logger.error("No aws region. Set AWS_REGION environment variable.");
  process.exit(1);
}
