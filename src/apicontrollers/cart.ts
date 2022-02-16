import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import { Roles } from "../models/Roles";
import { mongoID } from "../util/apiValidation";
import { cartService } from "../services/cart";
import { IMeResponse } from "../services/user";
import { couponService } from "../services/coupon";
const router = Router();

export interface cartRequestBody {
  productId: string;
  quantity: number;
}

router.post(
  "/",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("cart", "cart is required").isArray().run(req);
    await apiValidation(req, res);

    try {
      const cart = req.body.cart as cartRequestBody[];
      const user = req.user as IMeResponse;
      const response = await cartService.createCart(cart, user.id);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.post(
  "/guestUser",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("cart", "cart is required").isArray().run(req);
    await apiValidation(req, res);

    try {
      const cart = req.body.cart as cartRequestBody[];
      const response = await cartService.createGuestCart(cart);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/guestUser/:cartId",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("cart", "cart is required").isArray().run(req);
    await check("cartId", "cartId is required").notEmpty().run(req);
    await apiValidation(req, res);

    try {
      const cart = req.body.cart as cartRequestBody[];
      const cartId: string = req.body.cartId;
      const response = await cartService.updateGuestCart(cart, cartId);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/",
  Authenticate(),
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
    try {
      let page = req.query.page || 1;
      let perPage = req.query.perPage || 10;

      page = parseInt(page as string);
      perPage = parseInt(perPage as string);
      const filter: any = req.query.filter;
      let cond = {};
      if (filter) {
        cond = JSON.parse(filter);
      }

      const response = await cartService.find(cond);

      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);
router.get(
  "/mycart",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IMeResponse;
      const guestCartId = (req.query.guestCartId as string) || "";
      console.log(guestCartId);
      const response = await cartService.getMyCart(user.id, guestCartId);
      const result = await couponService.verifyCoupons(
        response,
        user.id,
        user.email
      );
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/guestUser",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("cartId", "cartId is requred as a query parameter")
      .exists()
      .run(req);
    apiValidation(req, res);
    try {
      const user = req.user as IMeResponse;
      const cartId = req.query.cartId as string;
      const response = await cartService.findById(cartId);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.delete(
  "/",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IMeResponse;
      const response = await cartService.deleteCart(user.id);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
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

    try {
      const result = await cartService.findById(req.params.id, [
        "cartItems.product",
      ]);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
