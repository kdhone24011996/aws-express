/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  errorHandler404,
  errorUnhandledRejection,
  errorUncughtException,
  errorHandlerAll,
} from "./util/apiHelpers";

process.on("uncaughtException", errorUncughtException);

import express from "express";
import compression from "compression"; // compresses requests
import lusca from "lusca";
import mongoose from "mongoose";
import passport from "passport";
import bluebird from "bluebird";
import cors from "cors";

import swaggerUi from "swagger-ui-express";
import schedule from "node-schedule";

import { MONGODB_URI } from "./util/secrets";
import logger from "./util/logger";

// API keys and Passport configuration
import "./config/passport";

import userApiController from "./apicontrollers/user";
import productApiController from "./apicontrollers/product";
import cartApiController from "./apicontrollers/cart";
import categoryApiController from "./apicontrollers/category";
import orderyApiController from "./apicontrollers/order";
import cancelOrderyApiController from "./apicontrollers/order/cancelOrder";
import emailApiController from "./apicontrollers/email";
import attributeController from "./apicontrollers/attribute";
import variationController from "./apicontrollers/variation";
import couponController from "./apicontrollers/coupon";
import { couponService } from "./services/coupon";
import { cartService } from "./services/cart";
import cmsController from "./apicontrollers/cms";
// Create Express server
const app = express();

// Connect to MongoDB
const mongoUrl = MONGODB_URI;

mongoose.Promise = bluebird;
logger.info(mongoUrl);
mongoose
  .connect(mongoUrl, {})
  .then(() => {
    /** ready to use. The `mongoose.connect()` promise resolves to undefined. */

    logger.info("Mongo connected!!!");
    logger.info(
      `Using mongo host '${mongoose.connection.host}' and port '${mongoose.connection.port}'`
    );
  })
  .catch((err: any) => {
    logger.error(
      `MongoDB connection error. Please make sure MongoDB is running. ${err}`
    );
    // process.exit();
  });

// Express configuration
const whitelist = ["http://localhost"];
const corsOptions = {
  origin(origin: string, callback: (error: any, res?: boolean) => any) {
    if (origin) {
      const arOrigin = origin.split(":");
      const url = `${arOrigin[0]}:${arOrigin[1]}`;
      if (!origin || whitelist.indexOf(url) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      callback(null, true);
    }
  },
  methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
};
app.use(cors(corsOptions));

// runs the script after every minute
const job = schedule.scheduleJob("jobId", "*/1 * * * *", function () {
  console.log("The answer to life, the universe, and everything!");
  // schedule.cancelJob("jobId");
  // check for coupon expiry date
  couponService.checkStatus();
  // check for abandoned carts
  cartService.checkForAbandonedCarts();
});

// job.cancel();
// process.on("SIGTERM", () => schedule.gracefulShutdown());
// process.on('SIGINT', shutDown);
// below text is used for to run cron job every day at midnight
// 0 0 * * *
app.use(compression());
app.use(express.json({ limit: 10000000 }));
app.use(express.urlencoded({ extended: true, limit: 10000000 }));

app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.use(passport.initialize());
/**
 * Our API Section
 */
app.use("/api/v1/user", userApiController);
app.use("/api/v1/email", emailApiController);
app.use("/api/v1/product", productApiController);
app.use("/api/v1/cart", cartApiController);
app.use("/api/v1/category", categoryApiController);
app.use("/api/v1/order/cancel", cancelOrderyApiController);
app.use("/api/v1/order", orderyApiController);
app.use("/api/v1/attribute", attributeController);
app.use("/api/v1/variation", variationController);
app.use("/api/v1/coupon", couponController);
app.use("/api/v1/cms", cmsController);
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: "/swagger.json",
    },
  })
);

/**
 * Other handlers
 */
app.all("*", errorHandler404);

// Global Error handler
app.use(errorHandlerAll);

process.on("unhandledRejection", errorUnhandledRejection);

app.listen(process.env.PORT || 8000, () => {
  logger.info("connected");
  logger.info(`server is running in ${process.env.NODE_ENV || "development"}`);
});
export default app;
