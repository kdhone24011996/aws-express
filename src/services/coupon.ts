import { Request, response } from "express";
import { Model, Types } from "mongoose";
import { mongoID } from "../util/apiValidation";
import {
  ICoupon,
  CouponDoc,
  coupon,
  couponStatus,
  discountType,
} from "../models/coupon";
import { cartService } from "./cart";
import { DatabaseService } from "./database";
import { productService } from "./product";
import _ from "lodash";
import { CartDoc, ICartAppliedCoupon } from "../models/Cart";
import logger from "../util/logger";

class CouponService extends DatabaseService<ICoupon, CouponDoc> {
  constructor(model: Model<CouponDoc>) {
    super(model);
  }

  public async createCoupon(req: Request) {
    const {
      name,
      code,
      discountType,
      discount,
      description = "",
      expiryDate = null,
      allowedCategories = null,
      allowedProducts = null,
      excludedCategories = null,
      excludedProducts = null,
      couponUsageLimit = null,
      numberOfUsersLimit = null,
      singleUserUseLimit = null,
      minimumSpend = null,
      xItemLimit = null,
      allowedEmails = null,
      isForIndividualUseOnly = false,
    } = req.body;

    const postObj: ICoupon = {
      name,
      code,
      discountType,
      discount,
      description,
      expiryDate,
      allowedCategories,
      allowedProducts,
      excludedCategories,
      excludedProducts,
      couponUsageLimit,
      numberOfUsersLimit,
      singleUserUseLimit,
      minimumSpend,
      xItemLimit,
      allowedEmails,
      isForIndividualUseOnly,
    };
    const response = await this.create(postObj);
    return response;
  }
  public async updateCoupon(id: string, req: Request) {
    const coupon = await this.findById(id);

    const {
      name = coupon.name,
      discountType = coupon.discountType,
      discount = coupon.discount,
      description = coupon.description,
      expiryDate = coupon.expiryDate,
      allowedCategories = coupon.allowedCategories,
      allowedProducts = coupon.allowedProducts,
      excludedCategories = coupon.excludedCategories,
      excludedProducts = coupon.excludedProducts,
      couponUsageLimit = coupon.couponUsageLimit,
      numberOfUsersLimit = coupon.numberOfUsersLimit,
      singleUserUseLimit = coupon.singleUserUseLimit,
      minimumSpend = coupon.minimumSpend,
      xItemLimit = coupon.xItemLimit,
      allowedEmails = coupon.allowedEmails,
      status = coupon.status,
      isForIndividualUseOnly = coupon.isForIndividualUseOnly,
    } = req.body;

    const postObj: Partial<ICoupon> = {
      name,
      discountType,
      discount,
      description,
      expiryDate,
      allowedCategories,
      allowedProducts,
      excludedCategories,
      excludedProducts,
      couponUsageLimit,
      numberOfUsersLimit,
      singleUserUseLimit,
      minimumSpend,
      xItemLimit,
      allowedEmails,
      status,
      isForIndividualUseOnly,
    };
    const response = await this.update(id, postObj);
    return response;
  }

  public async applyCart(
    cartId: string,
    couponCode: string,
    userId: string,
    email: string,
    type: string = "apply"
  ) {
    const couponResponse = await this.find({ code: couponCode });
    if (couponResponse.data.length === 0) {
      throw new Error(`Coupon with code ${couponCode} does not exists`);
    }
    const coupon = couponResponse.data[0];

    const cart = await cartService.findById(cartId, [
      { path: "cartItems.product", select: "name categories price" },
      { path: "appliedCoupons.coupon", select: "code isForIndividualUseOnly" },
    ]);

    if (coupon.status !== couponStatus.ACTIVE) {
      throw new Error(`Coupon with code ${couponCode} is not active`);
    }

    if (coupon.allowedEmails) {
      const idx = coupon.allowedEmails.indexOf(email);
      if (idx === -1) {
        throw new Error(
          ` User with Email ${email} is not allowed to use Coupon with code ${couponCode}`
        );
      }
    }

    if (
      coupon.isForIndividualUseOnly === true &&
      cart.appliedCoupons.length > 0
    ) {
      throw new Error(
        `coupon with code ${couponCode} cannot be used with other coupons`
      );
    } else {
      for (let appliedCoupon of cart.appliedCoupons) {
        if (appliedCoupon.coupon.isForIndividualUseOnly) {
          throw new Error(
            `coupon with code ${appliedCoupon.coupon.code} cannot be used with other coupons`
          );
        }
      }
    }

    const idx = cart.appliedCoupons.findIndex(
      (item) => item.coupon.code === couponCode
    );
    if (idx !== -1) {
      throw new Error(
        `coupon with code ${couponCode} is already used in this cart`
      );
    }

    const { singleUserUseLimit, usageDetails, couponUsageLimit } = coupon;

    if (coupon.minimumSpend && cart.totalPrice < coupon.minimumSpend) {
      throw new Error(
        ` The minimum spend for this coupon is ${coupon.minimumSpend}`
      );
    }

    if (couponUsageLimit && usageDetails.length >= couponUsageLimit) {
      throw new Error(
        `This coupon is already reached to its maximum limit of usage`
      );
    }
    if (singleUserUseLimit) {
      const thisCouponUsedByMe = usageDetails.filter(
        (item) => item.user.toString() === userId.toString()
      );
      if (thisCouponUsedByMe.length >= singleUserUseLimit) {
        throw new Error(
          "you have already reached to the maximum number of times this coupon can be used by a single user"
        );
      }
    }
    if (coupon.discountType === discountType.FIXED_CART_DISCOUNT) {
      if (coupon.allowedProducts) {
        const notAllowedProducts = cart.cartItems.filter(
          (item) =>
            coupon.allowedProducts.indexOf(
              new Types.ObjectId(item.product.id)
            ) === -1
        );
        if (notAllowedProducts.length > 0) {
          throw new Error(
            `product ${notAllowedProducts[0].product.name} is not allowed to use this coupon`
          );
        }
      }
      if (coupon.allowedCategories) {
        const notAllowedCategories = cart.cartItems.filter(
          (item) =>
            coupon.allowedCategories.indexOf(item.product.categories) === -1
        );
        if (notAllowedCategories.length > 0) {
          throw new Error(
            `category ${notAllowedCategories[0].product.categories} is not allowed to use this coupon`
          );
        }
      }
      if (coupon.excludedProducts) {
        const excludedProductsInTheCart = cart.cartItems.filter(
          (item) =>
            coupon.excludedProducts.indexOf(
              new Types.ObjectId(item.product.id)
            ) === -1
        );
        if (excludedProductsInTheCart.length > 0) {
          throw new Error(
            `product ${excludedProductsInTheCart[0].product.name} is not allowed to use this coupon`
          );
        }
      }

      if (coupon.excludedCategories) {
        const excludedCategoriesInTheCart = cart.cartItems.filter(
          (item) =>
            coupon.excludedCategories.indexOf(item.product.categories) === -1
        );
        if (excludedCategoriesInTheCart.length > 0) {
          throw new Error(
            `category ${excludedCategoriesInTheCart[0].product.categories} is not allowed to use this coupon`
          );
        }
      }

      // no need to check for xItemLimits for FIXED_PRODUCT_CART type.
      let couponObj = {
        coupon: coupon._id,
        totalDiscount: coupon.discount,
      };
      if (type === "apply") {
        cart.appliedCoupons.push(couponObj);
        await cart.save();
        return await cartService.findById(cartId, [
          { path: "cartItems.product" },
          { path: "appliedCoupons.coupon", select: "code name description" },
        ]);
      } else {
        return couponObj;
      }
    }
    if (coupon.discountType === discountType.FIXED_PRODUCT_DISCOUNT) {
      let totalApplicableDiscountQuantity = 0;
      if (coupon.allowedProducts) {
        for (let cartItem of cart.cartItems) {
          // check if the current cartItem is there in the allowed products
          // if yes then increase the totalApplicableDiscountQuantity by
          // the quanty of that product in the cart
          const idx = coupon.allowedProducts.indexOf(
            cartItem.product.id.toString()
          );
          if (idx !== -1) {
            totalApplicableDiscountQuantity += cartItem.quantity;
          }
        }
        // check for the xLimit
        if (
          coupon.xItemLimit &&
          totalApplicableDiscountQuantity > coupon.xItemLimit
        ) {
          totalApplicableDiscountQuantity = coupon.xItemLimit;
        }
      } else if (coupon.allowedCategories) {
        for (let cartItem of cart.cartItems) {
          const idx = coupon.allowedCategories.indexOf(
            cartItem.product.categories
          );
          if (idx !== -1) {
            totalApplicableDiscountQuantity += cartItem.quantity;
          }
        }
        // check for the xLimit
        if (
          coupon.xItemLimit &&
          totalApplicableDiscountQuantity > coupon.xItemLimit
        ) {
          totalApplicableDiscountQuantity = coupon.xItemLimit;
        }
      } else if (coupon.excludedProducts) {
        for (let cartItem of cart.cartItems) {
          const idx = coupon.excludedProducts.indexOf(
            cartItem.product.id.toString()
          );
          if (idx === -1) {
            totalApplicableDiscountQuantity += cartItem.quantity;
          }
        }
        // check for the xLimit
        if (
          coupon.xItemLimit &&
          totalApplicableDiscountQuantity > coupon.xItemLimit
        ) {
          totalApplicableDiscountQuantity = coupon.xItemLimit;
        }
      } else if (coupon.excludedCategories) {
        for (let cartItem of cart.cartItems) {
          const idx = coupon.excludedCategories.indexOf(
            cartItem.product.categories
          );
          if (idx === -1) {
            totalApplicableDiscountQuantity += cartItem.quantity;
          }
        }
        // check for the xLimit
        if (
          coupon.xItemLimit &&
          totalApplicableDiscountQuantity > coupon.xItemLimit
        ) {
          totalApplicableDiscountQuantity = coupon.xItemLimit;
        }
      } else {
        for (let cartItem of cart.cartItems) {
          totalApplicableDiscountQuantity += cartItem.quantity;
        }
      }
      const totalCouponDiscount =
        coupon.discount * totalApplicableDiscountQuantity;

      // no need to check for xItemLimits for FIXED_PRODUCT_CART type.
      let couponObj = {
        coupon: coupon._id,
        totalDiscount: totalCouponDiscount,
      };
      if (type === "apply") {
        cart.appliedCoupons.push(couponObj);
        await cart.save();
        return await cartService.findById(cartId, [
          { path: "cartItems.product" },
          { path: "appliedCoupons.coupon", select: "code name description" },
        ]);
      } else {
        return couponObj;
      }
    }
    if (coupon.discountType === discountType.PERCENTAGE) {
      let totalDiscount = 0;
      const xItemLimit = coupon.xItemLimit;
      let totalQuantityAdded = 0;
      // sort the cartItems on the basis of price in the descending order.
      const sortedCartItems = _.sortBy(
        cart.cartItems,
        "product.price"
      ).reverse();
      if (coupon.allowedProducts || coupon.excludedProducts) {
        for (let cartItem of sortedCartItems) {
          let products = coupon.allowedProducts;

          if (coupon.excludedProducts) {
            products = coupon.excludedProducts;
          }
          const idx = products.indexOf(cartItem.product.id.toString());
          let cond = idx !== -1;
          if (coupon.excludedProducts) {
            cond = idx === -1;
          }
          if (cond) {
            if (
              xItemLimit > totalQuantityAdded + cartItem.quantity ||
              !xItemLimit
            ) {
              // can add all the quantity of this product for discount
              // console.log("product price at full", cartItem.product.price);
              // console.log("count", totalQuantityAdded);
              totalDiscount +=
                (cartItem.quantity * cartItem.product.price * coupon.discount) /
                100;
            }
            if (
              xItemLimit > totalQuantityAdded &&
              xItemLimit < totalQuantityAdded + cartItem.quantity
            ) {
              const remainingQuantity = xItemLimit - totalQuantityAdded;

              totalDiscount +=
                (remainingQuantity * cartItem.product.price * coupon.discount) /
                100;

              console.log("product price at remaining", cartItem.product.price);
              console.log("count", totalQuantityAdded);
              console.log("remainingQuantity", remainingQuantity);
            }
            totalQuantityAdded += cartItem.quantity;
          }
        }
      } else if (coupon.allowedCategories || coupon.excludedCategories) {
        for (let cartItem of sortedCartItems) {
          let categories = coupon.allowedCategories;

          if (coupon.excludedProducts) {
            categories = coupon.excludedCategories;
          }
          const idx = categories.indexOf(
            cartItem.product.categories.toString()
          );
          let cond = idx !== -1;
          if (coupon.excludedCategories) {
            cond = idx === -1;
          }
          if (cond) {
            if (
              xItemLimit > totalQuantityAdded + cartItem.quantity ||
              !xItemLimit
            ) {
              // can add all the quantity of this product for discount
              totalDiscount +=
                (cartItem.quantity * cartItem.product.price * coupon.discount) /
                100;
            }
            if (
              xItemLimit > totalQuantityAdded &&
              xItemLimit < totalQuantityAdded + cartItem.quantity
            ) {
              const remainingQuantity = xItemLimit - totalQuantityAdded;

              totalDiscount +=
                (remainingQuantity * cartItem.product.price * coupon.discount) /
                100;
            }
          }
          totalQuantityAdded += cartItem.quantity;
        }
      } else {
        for (let cartItem of sortedCartItems) {
          if (
            xItemLimit > totalQuantityAdded + cartItem.quantity ||
            !xItemLimit
          ) {
            // can add all the quantity of this product for discount
            totalDiscount +=
              (cartItem.quantity * cartItem.product.price * coupon.discount) /
              100;
          }
          if (
            xItemLimit > totalQuantityAdded &&
            xItemLimit < totalQuantityAdded + cartItem.quantity
          ) {
            const remainingQuantity = xItemLimit - totalQuantityAdded;
            console.log("product price at remaining", cartItem.product.price);
            totalDiscount +=
              (remainingQuantity * cartItem.product.price * coupon.discount) /
              100;
          }
          totalQuantityAdded += cartItem.quantity;
        }
      }
      let couponObj = {
        coupon: coupon._id,
        totalDiscount: totalDiscount,
      };
      if (type === "apply") {
        cart.appliedCoupons.push(couponObj);
        await cart.save();
        return await cartService.findById(cartId, [
          { path: "cartItems.product" },
          { path: "appliedCoupons.coupon", select: "code name description" },
        ]);
      } else {
        return couponObj;
      }
    }
  }

  public async checkStatus() {
    console.log("ran cron job");
    try {
      const { data } = await this.find({}, 1, 100000000000000);
      for (let coupon of data) {
        if (
          coupon.status === couponStatus.ACTIVE &&
          coupon.expiryDate &&
          coupon.expiryDate.getTime() <
            new Date(new Date().toUTCString()).getTime()
        ) {
          await coupon.update({ status: couponStatus.EXPIRED });
        }
      }
    } catch (err) {
      logger.debug("checkCouponStatus", err);
    }
    return "Done";
  }

  public async verifyCoupons(cart: CartDoc, userId: string, email: string) {
    const appliedCoupons = [...cart.appliedCoupons];
    await cart.update({ appliedCoupons: [] });
    const newValidCoupons: any = [];
    for (let appliedCoupon of appliedCoupons) {
      try {
        const coupon = await this.applyCart(
          cart.id,
          appliedCoupon.coupon.code,
          userId,
          email,
          "verify"
        );
        newValidCoupons.push(coupon);
      } catch (err) {
        logger.debug("err", err);
      }
    }
    cart.appliedCoupons = newValidCoupons;
    return await cart.save();
  }
}

export const couponService = new CouponService(coupon);
