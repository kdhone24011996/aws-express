import { NextFunction, Request, Router, Response } from "express";
import {
  apiError,
  apiOk,
  apiValidation,
  catchAsync,
} from "../../util/apiHelpers";
import { check } from "express-validator";
import { Authenticate, Authorize } from "../../config/auth";
import { mongoID } from "../../util/apiValidation";
import { Roles } from "../../models/Roles";
import { ICancelOrder } from "../../models/cancelOrder";
import { cancelOrderService } from "../../services/canelOrder";
import emailService from "../../services/email";
import logger from "../../util/logger";
import { orderService } from "../../services/order";
const router = Router();

export interface cartRequestBody {
  productId: string;
  quantity: number;
}

router.post(
  "/",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("order", "order must be a mongoId")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("reason", "reason is required").exists().run(req);
    await apiValidation(req, res);

    try {
      const { order, reason } = req.body;
      const orderResponse = await orderService.findById(order);
      console.log("order", order);
      const postObj: ICancelOrder = {
        order,
        reason,
      };
      const response = await cancelOrderService.create(postObj);
      const emailResponse = await emailService.sendRefundRequestNotification(
        // order.user.email
        "includ.tech@gmail.com",
        response.id.toString()
      );
      logger.debug("emailResponse", emailResponse);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

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
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const filter: any = req.query.filter;
    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    let cond = {};
    if (filter) {
      cond = JSON.parse(filter);
    }
    const result = await cancelOrderService.find(cond, page, perPage, []);

    apiOk(res, result);
  })
);

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);

    apiValidation(req, res);

    try {
      const result = await cancelOrderService.findById(req.params.id);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);
router.patch(
  "/:id",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("status", "status is required").exists().run(req);
    apiValidation(req, res);

    try {
      const id = req.params.id;
      const { status } = req.body;

      const result = await cancelOrderService.updateStatus(id, status);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
