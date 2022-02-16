import { Model, Mongoose, Schema, Types } from "mongoose";
import logger from "../util/logger";
import { cartRequestBody } from "../apicontrollers/cart";
import {
  ICart,
  CartDoc,
  Cart,
  ICartItemPrice,
  ICartItem,
  cartStatus,
} from "../models/Cart";
import { DatabaseService } from "./database";
import { productService } from "./product";

class CartService extends DatabaseService<ICart, CartDoc> {
  constructor(model: Model<CartDoc>) {
    super(model);
  }

  public async createGuestCart(cart: cartRequestBody[]) {
    const { arr, totalPrice } = await this.generateCartItems(cart);
    const finalCart: ICart = {
      cartItems: arr,
      totalPrice,
    };

    const response = await this.create(finalCart);
    return response;
  }
  public async updateGuestCart(cart: cartRequestBody[], cartId: string) {
    const { arr, totalPrice } = await this.generateCartItems(cart);

    const finalCart: ICart = {
      cartItems: arr,
      totalPrice,
    };
    const response = await this.update(cartId, finalCart);
    return response;
  }

  async generateCartItems(cart: cartRequestBody[]) {
    const arr: ICartItem[] = [];
    let totalPrice = 0;
    for (let cartItem of cart) {
      const productId = cartItem.productId;
      const product = await productService.findProductById(productId);
      const finalPrice = product.finalPrice;
      let quantity: number | string = `${cartItem.quantity || 1}`;
      quantity = parseInt(quantity);
      const price: ICartItemPrice = {
        priceBeforeDiscount: product.price * quantity,
        priceAfterDiscount: product.finalPrice * quantity,
      };

      arr.push({
        product: new Types.ObjectId(product.id),
        price,
        quantity,
      });
      totalPrice = totalPrice + product.finalPrice * quantity;
      logger.debug(product);
    }
    return { arr, totalPrice };
  }
  public async createCart(cart: cartRequestBody[], userId: string) {
    const { arr, totalPrice } = await this.generateCartItems(cart);

    // check for the cartItems are added as a guest User
    const finalCart: ICart = {
      cartItems: arr,
      user: new Types.ObjectId(userId),
      totalPrice,
    };
    logger.debug(finalCart);
    const CartExistsForMe = await this.find({
      user: new Types.ObjectId(userId),
    });
    logger.debug("cart exists", CartExistsForMe);
    if (CartExistsForMe.data.length == 0) {
      const response = await this.create(finalCart);
      return response;
    }
    const cartId = CartExistsForMe.data[0].id;
    const response = await this.update(cartId, finalCart);
    return response;
  }

  public async deleteCart(userId: string) {
    const CartExistsForMe = await this.find({
      user: new Types.ObjectId(userId),
    });
    logger.debug("cart exists", CartExistsForMe);
    if (CartExistsForMe.data.length == 0) {
      throw new Error(`Cart does not exists for userId ${userId}`);
    }
    const cartId = CartExistsForMe.data[0].id;
    const response = await this.delete(cartId);
    return response;
  }

  public async getMyCart(userId: string, guestCartId: string = "") {
    const CartExistsForMe = await this.find(
      {
        user: new Types.ObjectId(userId),
      },
      1,
      10,
      [
        { path: "cartItems.product" },
        { path: "appliedCoupons.coupon", select: "code name description" },
      ]
    );
    // logger.debug("cart exists", CartExistsForMe);
    if (CartExistsForMe.data.length == 0 && guestCartId === "") {
      // if no cart exists and no guest cartId exists
      throw new Error(`Cart does not exists for userId ${userId}`);
    }
    if (CartExistsForMe.data.length == 0 && guestCartId !== "") {
      // if no cart exists and  guest cartId exists
      const guestCart = await this.findById(guestCartId);
      const newCart: ICart = {
        user: new Types.ObjectId(userId),
        cartItems: guestCart.cartItems,
        totalPrice: guestCart.totalPrice,
      };
      const newCartCreated = await this.create(newCart);

      const response = await this.findById(newCartCreated.id, [
        // "cartItems.product",
        { path: "appliedCoupons.coupon", select: "code name" },
        { path: "cartItems.product" },
      ]);
      await guestCart.delete();
      return response;
    }
    const cart = CartExistsForMe.data[0];

    if (guestCartId) {
      // if cartExists guestCart id exists
      const response = await this.find({ _id: guestCartId }, 1, 10, [
        { path: "cartItems.product" },
      ]);
      // logger.debug("response length", response.data);
      console.log("guestCardId", guestCartId);
      logger.debug("guestCartId", guestCartId);
      if (response.data.length !== 0) {
        const guestCart = response.data[0];
        const cartItems = [...guestCart.cartItems, ...cart.cartItems];
        const totalPrice = guestCart.totalPrice + cart.totalPrice;
        cart.cartItems = cartItems;
        cart.totalPrice = totalPrice;
        await cart.save();
        cart.cartItems;
        await this.delete(guestCartId);
      }
    }
    // if cart exists and no guest cartId exists
    return cart;
  }

  public async checkForAbandonedCarts() {
    const response = await this.find({}, 1, 10000000000000000);
    const hour = 60 * 60 * 1000;
    try {
      if (response.data.length > 0) {
        const carts = response.data;
        for (let cart of carts) {
          console.log(cart.createdAt.getTime());
          console.log("hii");
          if (
            cart.createdAt.getTime() + hour <
              new Date(new Date().toUTCString()).getTime() &&
            cart.updatedAt.getTime() + hour <
              new Date(new Date().toUTCString()).getTime()
          ) {
            console.log("hello");
            cart.status = cartStatus.ABANDONED;
            console.log("make abandoned");
            await cart.save();
          }
        }
      }
    } catch (err) {
      logger.debug("checkForAbandonedCarts", err);
    }
    return "Done";
  }
}

export const cartService = new CartService(Cart);
