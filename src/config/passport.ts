import passport from "passport";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import _ from "lodash";

import { SESSION_SECRET } from "../util/secrets";
import { options } from "../util/jwt";
import { userService } from "../services/user";
import logger from "../util/logger";

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: SESSION_SECRET,
  issuer: options.issuer,
  audience: options.audience,
};

passport.use(
  new JwtStrategy(opts, async (token: any, done: any) => {
    const Id: string = token.user.id;
    logger.debug(token);
    try {
      const userAuthResponse = await userService.me(Id);
      done(null, userAuthResponse);
    } catch (err) {
      done(err, null);
    }
  })
);
