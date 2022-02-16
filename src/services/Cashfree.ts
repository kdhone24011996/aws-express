import axios from "axios";
import {
  CASHFREE_APP_ID,
  CASHFREE_BASE_URL,
  CASHFREE_SECRET_KEY,
} from "../util/secrets";
import { ProductDoc } from "../models/Product";
import { IOrder, orderDoc } from "../models/Order";
import logger from "../util/logger";
import crypto from "crypto";
import { CancelOrderDoc } from "../models/cancelOrder";
const appId = CASHFREE_APP_ID;
const secretKey = CASHFREE_SECRET_KEY;
const baseUrl = CASHFREE_BASE_URL;

const headers = {
  "Content-Type": "application/json",
  "x-api-version": "2021-05-21",
  "x-client-id": appId,
  "x-client-secret": secretKey,
};

class CashfreeService {
  public async addOrder(order: orderDoc) {
    const obj = {
      order_id: order._id.toString(),
      order_amount: order.totalPrice,
      order_currency: "INR",
      customer_details: {
        customer_id: order.user.id.toString(),
        customer_email: order.user.email,
        customer_phone: order.user.phoneNumber,
      },
      order_meta: {
        return_url:
          "http://localhost:3000/thankyouPage?cf_id={order_id}&cf_token={order_token}",
        notify_url:
          "https://9f32-150-242-205-208.ngrok.io/api/v1/order/payment_webhook",
      },
    };
    return axios
      .post(`${baseUrl}/orders`, obj, {
        headers: headers,
      })
      .then((res) => res.data);
  }

  public async getOrderById(id: string) {
    return axios
      .get(`${baseUrl}/orders/${id}`, {
        headers: headers,
      })
      .then((res) => res.data);
  }

  public async getSignature(data: any) {
    const signatureData =
      data["orderId"] +
      data["orderAmount"] +
      data["referenceId"] +
      data["txStatus"] +
      data["paymentMode"] +
      data["txMsg"] +
      data["txTime"];
    console.log("dataToHash", signatureData);
    console.log("secretKey", secretKey);
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(signatureData)
      .digest("base64");

    return signature;
  }

  public async refund(order: orderDoc, refund_id: string, refund_note: string) {
    const orderId = order.id.toString();
    const refund_amount =
      order.paymentDetails.cfDetails.cfTransactionDetails.orderAmount;

    const body = {
      refund_amount,
      refund_id,
      refund_note,
    };
    return axios
      .post(`${baseUrl}/orders/${orderId}/refunds`, body, {
        headers: headers,
      })
      .then((res) => res.data);
  }
}

export const cashfreeService = new CashfreeService();
