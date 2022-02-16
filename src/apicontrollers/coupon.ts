import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import { mongoID } from "../util/apiValidation";
import { couponService } from "../services/coupon";
import { Roles } from "../models/Roles";
import { IMeResponse } from "../services/user";
import { CouponDoc } from "../models/coupon";
import { CloudWatchLogs } from "aws-sdk";
import { cartService } from "../services/cart";
const router = Router();

router.post(
  "/",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("name", "name is required").exists().run(req);
    await check("code", "code is required").exists().run(req);
    await check("discountType", "discountType is required").exists().run(req);
    await check("discount", "discount is required").isNumeric().run(req);
    apiValidation(req, res);
    try {
      const response = await couponService.createCoupon(req);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error);
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

    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    const filter: any = req.query.filter;
    let cond = {};
    if (filter) {
      cond = JSON.parse(filter);
    }
    console.log(filter);
    try {
      const result = await couponService.find(cond, page, perPage, [
        { path: "allowedProducts", select: "name" },
        { path: "excludedProducts", select: "name" },
      ]);
      apiOk(res, result);
    } catch (err) {
      apiError(res, err);
    }
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
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const searchText = req.query.searchText || "";
    perPage = parseInt(perPage as string);
    page = parseInt(page as string);

    try {
      const nameCond = new RegExp(`${searchText}(\w+)?(\s\w+)?`, "i");
      let cond: any = {
        $or: [
          {
            name: nameCond,
          },
          {
            code: nameCond,
          },
        ],
      };

      logger.debug(cond, "cond");
      const coupons = await couponService.find(cond, page, perPage);
      apiOk(res, coupons);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.post(
  "/apply",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("cartId", "cartId is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("couponCode", "couponCode is required").exists().run(req);
    apiValidation(req, res);

    try {
      const { cartId, couponCode } = req.body;
      const user = req.user as IMeResponse;
      const response = await couponService.applyCart(
        cartId,
        couponCode,
        user.id,
        user.email
      );
      apiOk(res, response);
    } catch (err) {
      apiError(res, err);
    }
  })
);
router.post(
  "/checkAndUpdateStatus",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    apiValidation(req, res);

    try {
      const response = await couponService.checkStatus();
      apiOk(res, response);
    } catch (err) {
      apiError(res, err);
    }
  })
);
router.delete(
  "/remvoFromCart/:id",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    apiValidation(req, res);

    try {
      const user = req.user as IMeResponse;

      const { data } = await cartService.find({ user: user.id });
      if (data.length === 0) {
        throw new Error("Cart does not exists for this cart");
      }
      const couponId = req.params.id;
      const cart = data[0];
      const appliedCoupons = [...cart.appliedCoupons];
      const newAppliedCoupons = appliedCoupons.filter(
        (item) => item.coupon.toString() !== couponId.toString()
      );
      cart.appliedCoupons = newAppliedCoupons;
      const result = await cart.save();
      apiOk(res, result);
    } catch (err) {
      apiError(res, err);
    }
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
    const result = await couponService.delete(Id);
    apiOk(res, result);
  })
);
router.put(
  "/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    apiValidation(req, res);

    const id: string = req.params.id;

    try {
      const result = await couponService.updateCoupon(id, req);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
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
      const result = await couponService.findById(req.params.id, [
        { path: "allowedProducts", select: "name" },
        { path: "excludedProducts", select: "name" },
      ]);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
