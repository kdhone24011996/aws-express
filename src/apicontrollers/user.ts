import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import { IMeResponse, userService } from "../services/user";
import { IUser } from "../models/User";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import emailService from "../services/email";
import { mongoID } from "../util/apiValidation";
import { Roles } from "../models/Roles";
import qs from "qs";
const router = Router();

router.get(
  "/",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("verified", "verified must be a boolean value")
      .optional()
      .isBoolean()
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const filter: any = req.query.filter;
    logger.debug("newFilter", filter);
    console.log(typeof filter);
    // console.log(JSON.parse(filter));
    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    let cond: any = {};
    if (filter) {
      cond = JSON.parse(filter);
      //  [
      //    {
      //      "profile.firstName":'kushal'
      //    },
      //    {
      //      "verfication.verified":false
      //    }
      //  ]
    }
    console.log(filter);
    console.log(cond);

    const result = await userService.find(
      cond,
      page,
      perPage,
      [],
      "email profile"
    );

    apiOk(res, result);
  })
);

router.put(
  "/updateUserRole/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("role", "role is required").exists().run(req);
    apiValidation(req, res);
    const id = req.params.id;
    const role = req.body.role;
    if (!Object.values(Roles).includes(role)) {
      throw new Error(`${role} is not a valid role type`);
    }
    const user = await userService.findById(id);
    user.profile.role = role;
    const response = await user.save();
    apiOk(res, response);
  })
);

router.delete(
  "/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    apiValidation(req, res);

    const Id: string = req.params.id;
    const result = await userService.delete(Id);
    apiOk(res, result);
  })
);

router.get(
  "/search",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("name", "name is required and must be a string")
      .isString()
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const name = req.query.name || ("" as string);
    perPage = parseInt(perPage as string);
    page = parseInt(page as string);
    try {
      let products;

      let commonCondition = new RegExp(`${name}(\w+)?(\s\w+)?`);
      let firstNameCondition = new RegExp(`${name}(\w+)?(\s\w+)?`);
      let lastNameCondition = new RegExp(`(\w+)?(\s\w+)?`);
      if (typeof name === "string") {
        if (name.includes(" ")) {
          const nameArr = name.split(" ");
          firstNameCondition = new RegExp(`${nameArr[0]}(\w+)?(\s\w+)?`);
          lastNameCondition = new RegExp(`${nameArr[1]}(\w+)?(\s\w+)?`);
        }
      }
      const nameCond = new RegExp(`${name}(\w+)?(\s\w+)?`);
      let cond: any = {
        $or: [
          {
            $and: [
              {
                "profile.firstName": firstNameCondition,
              },
              {
                "profile.lastName": lastNameCondition,
              },
            ],
          },
          {
            email: commonCondition,
          },
          {
            "profile.lastName": commonCondition,
          },
        ],
      };
      logger.debug(cond, "cond");
      products = await userService.find(cond, page, perPage);
      apiOk(res, products);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.post(
  "/signup",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "email is not valid").isEmail().run(req);
    await check("password", "Password should be atleast 8 Character")
      .isLength({ min: 8 })
      .run(req);
    await check("confirmPassword", "Password and ConfirmPassword do not match")
      .equals(req.body.password)
      .run(req);
    apiValidation(req, res);
    const email = req.body.email;
    const password = req.body.password;
    const userExist = await userService.findUserExistByEmail(email);
    if (userExist) {
      return apiError(res, `User with email ${email} already exists`);
    }

    const user = await userService.signup({ email, password } as IUser);
    logger.debug(user);
    return apiOk(res, user);
  })
);

router.post(
  "/sendCode",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "Email is not valid").isEmail().run(req);

    apiValidation(req, res);

    const email: string = req.body.email;
    const result = await emailService.sendVerificationCode(email);
    apiOk(res, result);
  })
);

router.post(
  "/verify",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "Email is not valid").isEmail().run(req);
    await check("code", "code is not valid").isString().run(req);

    apiValidation(req, res);

    const email: string = req.body.email;
    const code: string = req.body.code;
    const result = await userService.verify(email, code);
    apiOk(res, result);
  })
);

router.post(
  "/login",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "email is not valid").isEmail().run(req);
    await check("password", "Password should be atleast 8 Character")
      .isLength({ min: 8 })
      .run(req);

    apiValidation(req, res);
    const email = req.body.email;
    const password = req.body.password;
    const result = await userService.login(email, password);
    try {
      if (!result) {
        throw new Error("email or password not match");
      }
      req.login(result.user.id, { session: false }, (err) => {
        if (err) {
          return apiError(res, err, 401);
        }
        apiOk(res, result);
      });
    } catch (error) {
      apiError(res, error, 401);
    }
  })
);

router.post(
  "/refresh",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("token", "token is required").exists().run(req);
    await check("refreshToken", "refreshToken is required").exists().run(req);
    apiValidation(req, res);

    const token: string = req.body.token;
    const refreshToken: string = req.body.refreshToken;
    try {
      const result = await userService.refreshToken(token, refreshToken);
      apiOk(res, result);
    } catch (err) {
      apiError(res, err, 500);
    }
  })
);

router.put(
  "/updateUserProfile",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("firstName", "firstName is required").exists().run(req);
    await check("lastName", "lastName is required").exists().run(req);

    await check("gender", "gender is required").exists().run(req);

    await check("shippingAddresses", "shippingAddress is required")
      .exists()
      .run(req);
    await check("phoneNumber", "phoneNumber is required").exists().run(req);
    apiValidation(req, res);
    logger.debug(req.user);
    const user = req.user as IMeResponse;
    try {
      const result = await userService.updateUserProfile(user, req.body);
      apiOk(res, result);
    } catch (err) {
      apiError(res, err, 500);
    }

    return apiOk(res, req.user);
  })
);

router.post(
  "/forgot",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("email", "email is invalid").isEmail().run(req);
    apiValidation(req, res);

    const email: string = req.body.email;
    const result = await userService.forgot(email);
    apiOk(res, result);
  })
);

router.post(
  "/resetPassword",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // await check("email", "Email is not valid")
    //   .isEmail()
    //   .run(req);
    // await check("resetCode", "resetCode is invalid")
    //   .isString()
    //   .run(req);
    await check("userId", "User id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("password", "Password must be at least 8 characters long")
      .isLength({ min: 8 })
      .run(req);
    await check("confirmPassword", "Password and confirmPassword do not match")
      .equals(req.body.password)
      .run(req);
    await check("resetCode", "resetCode id is required").exists().run(req);

    apiValidation(req, res);
    const userId: string = req.body.userId;
    //const email: string = req.body.email;
    const password: string = req.body.password;
    const resetCode = req.body.resetCode;

    // const result = await userService.resetPassword(email, resetCode, password);
    const result = await userService.resetPassword(userId, password, resetCode);
    apiOk(res, result);
  })
);

router.get(
  "/me",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // logger.debug("me", req.user);
    return apiOk(res, req.user);
  })
);
router.get(
  "/:id",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    apiValidation(req, res);

    const result = await userService.findById(req.params.id);
    apiOk(res, result);
  })
);

export default router;
