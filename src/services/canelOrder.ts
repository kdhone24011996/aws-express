import { Model } from "mongoose";
import { DatabaseService } from "./database";
import {
  cancelOrder,
  CancelOrderDoc,
  cancelOrderStatus,
  ICancelOrder,
} from "../models/cancelOrder";
import { orderService } from "./order";
import { orderStatus, transactionStatus } from "../models/Order";
import { cashfreeService } from "./Cashfree";
import logger from "../util/logger";
import emailService from "./email";

class CancelOrder extends DatabaseService<ICancelOrder, CancelOrderDoc> {
  constructor(model: Model<CancelOrderDoc>) {
    super(model);
  }
  public async updateStatus(id: string, status: cancelOrderStatus) {
    const cancleOrder = await this.findById(id);
    const order = await orderService.findById(cancleOrder.order.toString());

    if (status === cancelOrderStatus.APPROVED) {
      const { cfTransactionDetails } = order.paymentDetails.cfDetails;

      if (!cfTransactionDetails) {
        throw new Error("No payment is done to refund");
      }
      if (cfTransactionDetails.orderId !== order.id.toString()) {
        throw new Error("Order id does not match");
      }
      if (cfTransactionDetails.txStatus !== transactionStatus.SUCCESS) {
        throw new Error("Failed payment can not be refunded");
      }
      // need to check the already refunded case
      //   if(order.status === orderStatus.CANCELLED || order.paymentDetails.cfDetails.cfOrderDetail.order_status === )
      // }
      if (order.status === orderStatus.CANCELLED) {
        throw new Error("Order is already refunded");
      }
      const emailResponse = await emailService.sendRefundApprovedNotification(
        // order.user.email
        "includ.tech@gmail.com",
        order.id.toString()
      );
      logger.debug("emailResponse", emailResponse);
      const response = await cashfreeService.refund(
        order,
        order.id.toString(),
        cancleOrder.reason
      );
      logger.debug("refund response", response);
      order.status = orderStatus.CANCELLED;
      order.cancelNote = cancleOrder.reason;
    }
    if (status === cancelOrderStatus.REJECTED) {
      const emailResponse = await emailService.sendRefundRejectedNotification(
        // order.user.email
        "includ.tech@gmail.com",
        order.id.toString()
      );
    }
    cancleOrder.status = status;
    const response = await order.save();
    await cancleOrder.save();
    return response;
  }
}
export const cancelOrderService = new CancelOrder(cancelOrder);
