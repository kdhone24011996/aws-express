import { Request, Response, NextFunction } from "express";
import { check } from "express-validator";
import { Router } from "express";
import _ from "lodash";

import { catchAsync, apiValidation, apiOk } from "../util/apiHelpers";

import awsEmailService from "../email/AWSEmail";

const router = Router();
export default router;

/**gets the list of all users with role info */
//  Authorize(RoleTypes.ADMIN)

router.get(
  "/",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // await check("page", "page must be an integer greater than 0").optional().isInt({gt:0}).run(req);
    // await check("perPage", "perPage must be an integer greater than 0").optional().isInt({gt:0}).run(req);
    apiValidation(req, res);

    // let page = req.query.page || 1;
    // let perPage = req.query.perPage || 10;

    // page = parseInt(page as string);
    // perPage = parseInt(perPage as string);

    apiOk(res, "email endpoint");
  })
);

router.post(
  "/",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("to", "to is not valid").isEmail().run(req);
    await check("from", "from is not valid").isEmail().run(req);
    await check("subject", "subject is required").isString().run(req);
    await check("message", "message is required").isString().run(req);

    apiValidation(req, res);

    const from: string = req.body.from;
    const to: string = req.body.to;
    const subject: string = req.body.subject;
    const message: string = req.body.message;

    const result = await awsEmailService.send(from, to, subject, message);
    apiOk(res, result);
  })
);
