import { Model, startSession } from "mongoose";
import logger from "../util/logger";
import { IOrderItem, order, orderDoc, paymentMethod } from "../models/Order";
import { IOrder, IOrderAppliedCoupons } from "../models/Order";
import { DatabaseService } from "./database";
import { productService } from "./product";
import { userService } from "./user";
import { cartService } from "./cart";
import { ICartItem } from "../models/Cart";
import { couponService } from "./coupon";
import { IAddress } from "../models/User";

class Order extends DatabaseService<IOrder, orderDoc> {
  constructor(model: Model<orderDoc>) {
    super(model);
  }
  public async placeOrderByProductId(
    userId: string,
    productId: string,
    quantity: number,
    shippingAddress: IAddress
  ) {
    const user = await userService.findById(userId);

    const product = await productService.findById(productId);
    // logger.debug(product);
    const {
      image,
      discount,
      categories,
      sku,
      name,
      price,
      cms,
      finalPrice,
      slug,
      size,
      _id,
    } = product;
    const productData: IOrderItem = {
      image: {
        key: image.key,
        url: image.url,
      },
      discount,
      categories,
      sku,
      name,
      price,
      description: cms.whatIsIt,
      finalPrice,
      slug,
      quantity,
      size,
      _id: _id.toString(),
    };

    const newAvailableQuantity = product.availableQuantity - quantity;
    if (newAvailableQuantity < 0) {
      throw new Error(
        `There are only ${product.availableQuantity} quantity left`
      );
    }

    const orderData: IOrder = {
      products: [productData],
      user: {
        id: user.id,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        email: user.email,
        phoneNumber: user.profile.phoneNumber,
      },
      shippingAddress: shippingAddress,
      totalPrice: finalPrice * quantity,
    };

    logger.debug("orderData", orderData);
    const session = await startSession();
    await session.startTransaction();
    const response = await this.create(orderData, { session });
    (product.availableQuantity = newAvailableQuantity),
      await product.save({ session });
    try {
      const myCart = await cartService.getMyCart(userId);
      const idx = myCart.cartItems.findIndex(
        (item: ICartItem) => item.product.id.toString() === productId
      );
      if (idx !== -1) {
        const newCartItems = myCart.cartItems.filter(
          (item) => item.product.id.toString() !== productId
        );

        myCart.cartItems = newCartItems;
        myCart.totalPrice = myCart.totalPrice - product.finalPrice * quantity;
        await myCart.save({ session });
      }
    } catch (err) {
      logger.debug(err);
    } finally {
      await session.commitTransaction();
      return response;
    }
  }

  public async placeOrderByCartId(
    userId: string,
    cartId: string,
    payment_method: paymentMethod = paymentMethod.PREPAID,
    shippingAddress: IAddress
  ) {
    const user = await userService.findById(userId);
    const unVerfiedCart = await cartService.findById(cartId, [
      { path: "appliedCoupons.coupon", select: "code" },
    ]);
    const cart = await couponService.verifyCoupons(
      unVerfiedCart,
      user.id,
      user.email
    );
    cart.populate([{ path: "appliedCoupons.coupon" }]);
    const cartItems = cart.cartItems;
    const products: any = [];
    const session = await startSession();
    await session.startTransaction();

    for (const item of cartItems) {
      const product = await productService.findById(item.product.toString());
      // logger.debug(product);
      const {
        image,
        discount,
        categories,
        sku,
        name,
        price,
        cms,
        finalPrice,
        slug,
        size,
        _id,
      } = product;
      const productData: IOrderItem = {
        image: {
          key: image.key,
          url: image.url,
        },
        discount,
        categories,
        sku,
        name,
        price,
        description: cms.whatIsIt,
        finalPrice,
        slug,
        quantity: item.quantity,
        size,
        _id: _id.toString(),
      };

      const newAvailableQuantity = product.availableQuantity - item.quantity;
      if (newAvailableQuantity < 0) {
        throw new Error(
          `There are only ${product.availableQuantity} quantity left for ${product.name}`
        );
      }
      products.push(productData);

      // decrease the quantity of product inventry
      (product.availableQuantity = newAvailableQuantity),
        await product.save({ session });

      if (products.length === cartItems.length) {
        const couponData: IOrderAppliedCoupons[] = [];

        let totalCouponsDiscount = 0;
        for (let appliedCoupon of cart.appliedCoupons) {
          couponData.push({
            coupon: {
              name: appliedCoupon.coupon.name,
              code: appliedCoupon.coupon.code,
              description: appliedCoupon.coupon.description,
            },
            totalDiscount: appliedCoupon.totalDiscount,
          });
          totalCouponsDiscount += appliedCoupon.totalDiscount;
        }

        //calculate total price after applying coupons

        const orderData: IOrder = {
          products,
          user: {
            id: user.id,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            email: user.email,
            phoneNumber: user.profile.phoneNumber,
          },
          shippingAddress: shippingAddress,
          totalPrice: cart.totalPrice - totalCouponsDiscount,
          appliedCoupons: couponData,
        };
        if (payment_method) {
          orderData.paymentDetails = {};
          orderData.paymentDetails.paymentMethod = payment_method;
        }
        // logger.debug("orderData", orderData);

        //create order
        logger.debug("orderData", orderData);
        const response = await this.create(orderData, { session });
        // logger.debug("response", response);
        for (let appliedCoupon of cart.appliedCoupons) {
          const coupon = await couponService.findById(appliedCoupon.coupon.id);
          coupon.usageDetails.push({
            user: user.id,
            order: response.id,
          });
          await coupon.save();
        }
        //delete cart
        logger.debug(cart);
        const existingCart = await cartService.findById(cartId);
        await existingCart.remove({ session });
        await session.commitTransaction();
        return response;
      }
    }
  }
}

export const orderService = new Order(order);
