import { NextFunction, Request, Router, Response, response } from "express";
import {
  apiError,
  apiOk,
  apiValidation,
  catchAsync,
} from "../../util/apiHelpers";
import { check } from "express-validator";
import logger from "../../util/logger";
import { Authenticate, Authorize } from "../../config/auth";
import { Roles } from "../../models/Roles";
import { productService } from "../../services/product";
import { IProduct, IProductPreSave, ProductDoc } from "../../models/Product";
import { IProductImage } from "../../models/Product";
import { mongoID } from "../../util/apiValidation";
import { flattenObj } from "../../util/common";
import { orderService } from "../../services/order";
import { IMeResponse } from "../../services/user";
import { authenticate } from "passport";
import { shipRocketService } from "../../services/shiprocket";
import {
  cfOrderStatus,
  IOrder,
  orderStatus,
  paymentMethod,
  shippingStatus,
} from "../../models/Order";
import { cashfreeService } from "../../services/Cashfree";
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

    const result = await orderService.find(cond, page, perPage, []);

    apiOk(res, result);
  })
);

router.post(
  "/byProductId",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const productId = req.body.productId;
    const shippingAddress = req.body.shippingAddress;
    try {
      if (!productId) {
        throw new Error("productId is required");
      }
      const quantity = req.body.quantity || 1;
      const user = req.user as IMeResponse;
      const response = await orderService.placeOrderByProductId(
        user.id,
        productId,
        quantity,
        shippingAddress
      );

      apiOk(res, response);
    } catch (error) {
      apiError(res, error);
    }
  })
);

router.post(
  "/byCartId",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const cartId = req.body.cartId;
    const payment_method = req.body.paymentMethod || paymentMethod.PREPAID;
    const shippingAddress = req.body.shippingAddress;
    try {
      if (!cartId) {
        throw new Error("cartId is required");
      }

      const user = req.user as IMeResponse;
      const createdOrder = await orderService.placeOrderByCartId(
        user.id,
        cartId,
        payment_method,
        shippingAddress
      );
      if (createdOrder.paymentDetails.paymentMethod === paymentMethod.PREPAID) {
        const cashfreeResponse = await cashfreeService.addOrder(createdOrder);

        logger.debug(cashfreeResponse);
        const { cf_order_id, order_token, order_status } = cashfreeResponse;
        if (cf_order_id) {
          createdOrder.paymentDetails.cfDetails.cfOrderDetail.cf_order_id =
            cf_order_id;
        }
        if (order_token) {
          createdOrder.paymentDetails.cfDetails.cfOrderDetail.order_token =
            order_token;
        }
        if (order_status === cfOrderStatus.ACTIVE) {
          if (
            createdOrder.paymentDetails.paymentMethod === paymentMethod.PREPAID
          ) {
            createdOrder.status = orderStatus.PENDING_PAYMENT;
          }
        }
        // const response = await createdOrder.save();
        // apiOk(res, response);
        // return;
      } else {
        // for COD directly change order status to processing
        createdOrder.status = orderStatus.PROCESSING;
      }
      const shipRocketResponse = await shipRocketService.addOrders(
        createdOrder
      );
      logger.debug("shipRocketResponse", shipRocketResponse);
      createdOrder.shiprocket_order_id = shipRocketResponse.order_id;
      const response = await createdOrder.save();
      // console.log("response", response);
      apiOk(res, response);
    } catch (error) {
      console.log("error", error);
      apiError(res, error);
    }
  })
);

router.patch(
  "/:id",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const order = await orderService.findById(id);

      const {
        shippingAddress = order.shippingAddress,
        status = order.status,
        cancelNote = order.cancelNote,
      } = req.body;
      const updateBody: Partial<IOrder> = {
        shippingAddress,
        status,
        cancelNote,
      };
      if (
        status === orderStatus.CANCELLED &&
        order.status !== orderStatus.CANCELLED
      ) {
        if (!cancelNote) {
          throw new Error("cancelNote is required to change the order status");
        }

        if (order.paymentDetails.paymentMethod === paymentMethod.PREPAID) {
          const response = await cashfreeService.refund(
            order,
            order.id.toString(),
            cancelNote
          );
        }
      }
      const response = await orderService.update(id, updateBody);

      apiOk(res, response);
    } catch (error) {
      console.log("error", error);
      apiError(res, error);
    }
  })
);
router.post(
  "/updateShippingStatus",
  shipRocketService.authenticate,
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    logger.debug("headers", req.headers);
    try {
      logger.debug("webhook", req.body);
      const shiprocket_order_id = req.body.order_id;
      const response = await orderService.find({ shiprocket_order_id });
      if (response.data.length > 0) {
        const order = response.data[0];
        order.shippingDetails = req.body;
        if (req.body.current_status_id === shippingStatus.SHIPPED) {
          order.status = orderStatus.SHIPPED;
        }
        if (req.body.current_status_id === shippingStatus.DELIVERED) {
          if (order.paymentDetails.paymentMethod === paymentMethod.PREPAID) {
            order.status = orderStatus.COMPLETED;
          } else {
            order.status = orderStatus.PENDING_PAYMENT;
          }
        }

        const result = await order.save();
        logger.debug("result", result);
      }
      // apiOk(res, req.body);
    } catch (error) {
      apiError(res, error);
    }
  })
);

router.get(
  "/serviceability",
  // Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    check("Pin Code is required").isNumeric().run(req);
    apiValidation(req, res);
    try {
      const { pinCode } = req.body;
      const result = await shipRocketService.checkCourierServiceability(
        pinCode
      );

      apiOk(res, result);
    } catch (error) {
      apiError(res, error);
    }
  })
);

router.post(
  "/payment_webhook",

  // Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    logger.debug("/payment_webhook", req.body);
    try {
      // here we get two notification.
      // 1st has the body like below

      // {
      //   data: {
      //     order: {
      //       order_id: '61c46548642878aa071635e6',
      //       order_amount: 90,
      //       order_currency: 'INR',
      //       order_tags: null
      //     },
      //     payment: {
      //       cf_payment_id: 1223268,
      //       payment_status: 'SUCCESS',
      //       payment_amount: 90,
      //       payment_currency: 'INR',
      //       payment_message: 'Transaction Successful',
      //       payment_time: '2021-12-23T17:32:22+05:30',
      //       bank_reference: '503132',
      //       auth_id: '10000',
      //       payment_method: {},
      //       payment_group: 'wallet'
      //     },
      //     customer_details: {
      //       customer_name: null,
      //       customer_id: '6152d0d9f45cf026a295a6cf',
      //       customer_email: 'kushalAdmin@gmai.com',
      //       customer_phone: '9816512345'
      //     }
      //   }

      //and the 2nd has the body like below

      // {
      //   orderId: '61c45fa78e557e59e5a69857',
      //   orderAmount: '90.00',
      //   referenceId: '1223191',
      //   txStatus: 'FAILED',
      //   paymentMode: 'Wallet',
      //   txMsg: 'Your transaction has failed.',
      //   txTime: '2021-12-23 17:08:26',
      //   signature: '3vh+LivGVZxSGj5oPyLGoncpWU5k9O6fRgSLCCpH5CM=',
      //   level: 'debug',
      //   message: '/payment_webhook',
      //   timestamp: '2021-12-23T11:40:11.203Z'
      // }

      // we are active on second type of body while ignoring the first type
      if (!req.body.orderId) return;

      // console.log("hello");
      // console.log("orderId", req.body.orderId);
      const signature = await cashfreeService.getSignature(req.body);
      // console.log("cashfreeOrder", cashfreeOrder);
      // console.log("signature", signature);
      const realSignature = req.body.signature;
      // console.log("realSignature", realSignature);
      if (realSignature !== signature) throw new Error("Something went wrong");
      // logger.debug("order", order);

      const order = await orderService.findById(req.body.orderId);
      order.paymentDetails.cfDetails.cfTransactionDetails = req.body;
      // we can get order by id from cashfree using our mongo order id
      const cashfreeOrder = await cashfreeService.getOrderById(
        req.body.orderId
      );
      // console.log("order", order);
      // console.log("status", cashfreeOrder.order_status);
      // console.log(cashfreeOrder.order_status === orderStatus.PAID);
      if (
        cashfreeOrder.order_status === cfOrderStatus.PAID &&
        order.status === orderStatus.PENDING_PAYMENT
      ) {
        order.status = orderStatus.PROCESSING;
      }
      if (
        cashfreeOrder.order_status === cfOrderStatus.ACTIVE &&
        req.body.txStatus === orderStatus.FAILED &&
        order.status === orderStatus.PENDING_PAYMENT
      ) {
        order.status = orderStatus.FAILED;
      }
      await order.save();
      apiOk(res, "Success");
    } catch (error) {
      logger.debug("error", error);
      apiError(res, error);
    }
  })
);
router.post(
  "/verifyPayment",
  // Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { cf_token, cf_id } = req.body;
    try {
      // logger.debug("/payment_webhook", req.body);
      const order = await orderService.findById(cf_id);
      const cfOrderDetail = order.paymentDetails.cfDetails.cfOrderDetail;
      if (cfOrderDetail.order_token !== cf_token) {
        throw new Error("Token does not match");
      }
      if ((cfOrderDetail.order_status = cfOrderStatus.ACTIVE)) {
        const result = await cashfreeService.getOrderById(cf_id);
        if (result.order_status === cfOrderStatus.PAID) {
          order.status = orderStatus.PROCESSING;
        } else {
          order.status = orderStatus.FAILED;
        }
        // if(result.order_status === cfOrderStatus.EXPIRED){

        // }
      }
      const response = await order.save();
      // logger.debug(result);
      apiOk(res, response);
      // apiOk(res, req.body);
    } catch (error) {
      apiError(res, error);
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

    const result = await orderService.findById(req.params.id);
    apiOk(res, result);
  })
);

export default router;
