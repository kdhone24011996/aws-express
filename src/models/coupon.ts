import { Document, model, PopulatedDoc, Schema, Types } from "mongoose";
import { IAttribute } from "./attribute";

export enum discountType {
  PERCENTAGE = "Percentage",
  FIXED_PRODUCT_DISCOUNT = "FixedProductDiscount",
  FIXED_CART_DISCOUNT = "FixedCartDiscount",
}
export enum couponStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
  EXPIRED = "Expired",
  CONSUMED = "Consumed",
}

export type stringOrNull = string | null;
export type numberOrNull = number | null;
export type mongoIdsOrNull = Types.ObjectId[] | null;

export interface ICoupon {
  name: string;
  code: string;
  discountType: discountType;
  discount: number;
  description?: string;
  allowedCategories?: String[] | null;
  excludedCategories?: String[] | null;
  allowedProducts?: mongoIdsOrNull;
  excludedProducts?: mongoIdsOrNull;
  allowedEmails?: string[];
  couponUsageLimit?: numberOrNull;
  numberOfUsersLimit?: numberOrNull;
  expiryDate?: Date | null;
  singleUserUseLimit?: numberOrNull;
  usageDetails?: [
    {
      user: Types.ObjectId;
      order: Types.ObjectId;
    }
  ];
  status?: couponStatus;
  minimumSpend?: number;
  xItemLimit?: number;
  isForIndividualUseOnly?: boolean;
}

export interface CouponDoc extends ICoupon, Document {}
const schemaFields: Record<keyof ICoupon, any> = {
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  discountType: {
    type: String,
    enum: Object.values(discountType),
    required: true,
  },
  discount: { type: Number, required: true },
  description: { type: String },
  allowedCategories: {
    type: [String],
    default: null,
  },
  excludedCategories: {
    type: [String],
    default: null,
  },
  allowedProducts: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: null,
  },
  excludedProducts: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: [],
  },
  allowedEmails: { type: [String], default: null },
  couponUsageLimit: { type: Number, default: null },
  numberOfUsersLimit: { type: Number, default: null },
  expiryDate: { type: Date, default: null },
  singleUserUseLimit: { type: Number, default: null },
  usageDetails: {
    type: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        order: {
          type: Schema.Types.ObjectId,
          ref: "Order",
        },
      },
    ],
  },
  status: {
    type: String,
    enum: Object.values(couponStatus),
    default: "Active",
  },
  minimumSpend: { type: Number, default: null },
  xItemLimit: { type: Number, default: null },
  isForIndividualUseOnly: { type: Boolean, default: false },
};

const couponSchema = new Schema(schemaFields, { timestamps: true });

export const coupon = model<CouponDoc>("Coupon", couponSchema);
