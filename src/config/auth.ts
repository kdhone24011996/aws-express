import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { UserDoc } from "../models/User";
import { Roles } from "../models/Roles";
import { apiError } from "../util/apiHelpers";
import logger from "../util/logger";
import { IMeResponse } from "../services/user";

export const Authenticate = () => {
  const authFun = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "jwt",
      { session: false },
      async (err, user, info) => {
        if (err || info) {
          const msg =
            (err && err.message) ||
            (info && info.message) ||
            "Failed to authenticate";
          const error = new Error(msg);
          return apiError(res, error, 401);
        }

        req.login(user, { session: false }, async (error) => {
          if (error) {
            return apiError(res, error, 401);
          }
          next();
        });
      }
    )(req, res, next);
  };

  return authFun;
};

export const Authorize = (roles: Roles[] | Roles) => {
  const authorizeMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(new Error("Needs authentication before authorization"));
      }
      const user = req.user as IMeResponse;
      if (typeof roles === "string") {
        roles = [roles];
      }
      logger.debug(user);
      if (!user.role || !roles.includes(user.role)) {
        throw new Error(`You are not authorized to perform this task`);
      }

      return next();
    } catch (err) {
      next(err);
    }
  };

  const middlewares = [Authenticate(), authorizeMiddleware];
  return middlewares;
};
