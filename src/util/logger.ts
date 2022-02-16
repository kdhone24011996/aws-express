import dotenv from "dotenv";
import winston from "winston";
import { MongoDBTransportInstance, MongoDB } from "winston-mongodb";

// const {
//   MongoDB
// }: { MongoDB: MongoDBTransportInstance } = require("winston-mongodb");

dotenv.config();
const url =
  process.env.NODE_ENV === "production"
    ? process.env.MONGODB_URI
    : process.env.MONGODB_URI_LOCAL;

// const transportMongoDb = new MongoDB({
//   level: "error",
//   db:
//     "mongodb://almatins:4ng3lfr0mH34v3n!@128.199.188.111:27020/sqor?authSource=admin&readPreference=primary&appname=MongoDB%20Compass&ssl=false",
//   options: {
//     useUnifiedTopology: true
//   },
//   collection: "server_logs"
// });

const { combine, timestamp, prettyPrint, errors } = winston.format;

const options: winston.LoggerOptions = {
  format: combine(
    timestamp(),
    errors({ stack: true }), // <-- use errors format
    prettyPrint()
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    }),
    // transportMongoDb
    // new winston.transports.File({ filename: "debug.log", level: "debug" })
  ],
};

const logger = winston.createLogger(options);

if (process.env.NODE_ENV !== "production") {
  logger.debug("Logging initialized at debug level");
}

export default logger;
