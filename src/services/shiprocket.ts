import axios from "axios";
import {
  SHIPROCKET_EMAIL,
  SHIPROCKET_PASSWORD,
  SHIPRROCKET_CHANNEL_ID,
  SHIPRROCKET_PRIMARY_PICKUP_LOCATION_ID,
  SHIPRROCKET_TOKEN,
  SHIPRROCKET_WEBHOOK_TOKEN,
} from "../util/secrets";
import { ProductDoc } from "../models/Product";
import { orderDoc } from "../models/Order";
import logger from "../util/logger";
import { NextFunction, Request, Response } from "express";
import fs from "fs";

const token = SHIPRROCKET_TOKEN;
const primaryPickupLocationId = SHIPRROCKET_PRIMARY_PICKUP_LOCATION_ID;
const channelId = SHIPRROCKET_CHANNEL_ID;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

axios.interceptors.response.use(
  function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    console.log("in interceptor");
    return response;
  },
  function (error) {
    logger.debug(error);
    // console.log("error in interceptor");
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    console.log(error);
    console.log(error.response.data.status_code);
    if (error.response.data.status_code === 401) {
      const loginUrl = "https://apiv2.shiprocket.in/v1/external/auth/login";
      const data = {
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD,
      };
      axios
        .post(loginUrl, data)
        .then((res) => {
          console.log("shiprocket login success");
          console.log("token", res.data.token);
          const token = res.data.token;
          fs.appendFile(".env", `SHIPRROCKET_TOKEN=${token}`, function (err) {
            console.log(err);
            if (err) throw err;
          });

          fs.readFile(".env", "utf8", function (err, data) {
            if (err) {
              return console.log(err);
            }
            const stringToreplace = `SHIPRROCKET_TOKEN = ${SHIPRROCKET_TOKEN}`;
            console.log(
              "`SHIPRROCKET_TOKEN=${SHIPRROCKET_TOKEN}`",
              `SHIPRROCKET_TOKEN=${SHIPRROCKET_TOKEN}`
            );
            const regX = new RegExp(stringToreplace, "g");
            var result = data.replace(regX, `SHIPRROCKET_TOKEN=${token}`);
            console.log("result", result);
            fs.writeFile(".env", result, "utf8", function (err) {
              if (err) return console.log(err);
            });
          });
        })
        .catch((err) => {
          console.log("err", err);
        });
    }
    return Promise.reject(error);
  }
);

class ShipRocketService {
  constructor() {}
  public async addProduct(product: ProductDoc) {
    const { sku, availableQuantity, name, categories } = product;
    const type = "Single";

    const productObj = JSON.stringify({
      qty: availableQuantity,
      category_code: "default",
      name,
      sku,
      type,
    });

    return axios
      .post("https://apiv2.shiprocket.in/v1/external/products", productObj, {
        headers: headers,
      })
      .then((res) => res.data);
    // .catch(async (err) => {
    //   // logger.debug("err", err.status);
    //   console.log("err", err.response.status);
    //   if (err.response.status === 401) {
    //     const loginUrl = "https://apiv2.shiprocket.in/v1/external/auth/login";
    //     // const respponse = await this.updateShipRocketToken()
    //     fs.writeFile(".env", "SHIPRROCKET_TOKEN=var", function (err) {
    //       if (err) throw err;
    //     });
    //   }
    //   throw new Error(err);
    // });
  }

  public async addOrders(order: orderDoc) {
    const productItems = [];

    for (const product of order.products) {
      productItems.push({
        name: product.name,
        sku: product.sku,
        units: product.quantity,
        selling_price: product.price,
        discount: product.price - product.finalPrice,
        tax: "",
        // hsn: 441122,
      });
    }

    let length = 1;
    let breadth = 1;
    let height = 1;
    let weight = 1;

    if (order.products.length === 1 && order.products[0].quantity === 1) {
      const product = order.products[0];
      length = product.size.length;
      breadth = product.size.breadth;
      height = product.size.height;
      weight = product.size.weight;
      console.log("size", product.size);
    }
    const orderObj = JSON.stringify({
      order_id: order._id,
      order_date: order.get("createdAt"),
      pickup_location: "Primary",
      channel_id: channelId,
      // comment: "Reseller: M/s Goku",
      billing_customer_name: order.user.firstName,
      billing_last_name: order.user.lastName,
      billing_address: order.shippingAddress.line1,
      billing_address_2: order.shippingAddress.line2,
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.zipCode,
      billing_state: order.shippingAddress.state,
      billing_country: order.shippingAddress.country,
      billing_email: order.user.email,
      billing_phone: order.shippingAddress.phoneNumber,
      shipping_is_billing: true,
      // shipping_customer_name: "",
      // shipping_last_name: "",
      // shipping_address: "",
      // shipping_address_2: "",
      // shipping_city: "",
      // shipping_pincode: "",
      // shipping_country: "",
      // shipping_state: "",
      // shipping_email: "",
      // shipping_phone: "",
      order_items: productItems,
      payment_method: order.paymentDetails.paymentMethod,
      // shipping_charges: 0,
      // giftwrap_charges: 0,
      // transaction_charges: 0,
      // total_discount: 0,
      sub_total: order.totalPrice,
      length,
      breadth,
      height,
      weight,
    });
    return axios
      .post(
        "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
        orderObj,
        {
          headers: headers,
        }
      )
      .then((res) => {
        // logger.debug(res.data);
        return res.data;
      });
    // .catch((err) => console.log("hello"));
  }
  public async checkCourierServiceability(
    pickup_postcode: number = 400072,
    delivery_postcode: number = 400072,
    weight = 2,
    cod = 1
  ) {
    const orderObj = {
      pickup_postcode,
      delivery_postcode,
      weight,
      cod,
    };
    return axios
      .get(
        "https://apiv2.shiprocket.in/v1/external/courier/serviceability/",
        // orderObj,
        {
          headers: headers,
          data: orderObj,
        }
      )
      .then((res) => {
        logger.debug("data", res.data);
        return res.data;
      });
  }
  public authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers["x-api-key"];
      if (token === SHIPRROCKET_WEBHOOK_TOKEN) {
        console.log("token matched");
        return next();
      }
      throw new Error("Webhook authentication failed");
    } catch (err) {
      next(err);
    }
  }
}

export const shipRocketService = new ShipRocketService();
