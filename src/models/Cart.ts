import {
  Document,
  model,
  Mongoose,
  ObjectId,
  PopulatedDoc,
  Schema,
  Types,
} from "mongoose";
import { ICoupon } from "./coupon";
import { IProduct } from "./Product";

export enum cartStatus {
  ACTIVE = "ACTIVE",
  ABANDONED = "ABANDONED",
}

export interface ICartItemPrice {
  priceBeforeDiscount: number;
  priceAfterDiscount: number;
}

export interface ICartItem {
  product: PopulatedDoc<IProduct & Document>;
  quantity: number;
  price: ICartItemPrice;
}

export interface ICartAppliedCoupon {
  coupon: PopulatedDoc<ICoupon & Document>;
  totalDiscount: number;
}

export interface ICart {
  cartItems: ICartItem[];
  user?: Types.ObjectId;
  totalPrice: number;
  appliedCoupons?: ICartAppliedCoupon[];
  status?: cartStatus;
}

export interface CartDoc extends ICart, Document {
  createdAt: Date;
  updatedAt: Date;
}
const schemaFields: Record<keyof ICart, any> = {
  cartItems: {
    type: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: Number,
        price: {
          priceBeforeDiscount: Number,
          priceAfterDiscount: Number,
        },
      },
    ],
    index: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  appliedCoupons: {
    type: [
      {
        coupon: {
          type: Schema.Types.ObjectId,
          ref: "Coupon",
        },
        totalDiscount: Number,
      },
    ],
    default: [],
  },
  status: {
    type: String,
    enum: Object.values(cartStatus),
    default: cartStatus.ACTIVE,
  },
};

const cartSchema = new Schema(schemaFields, { timestamps: true });
cartSchema.index({ user: 1 }, { unique: true, background: true });

export const Cart = model<CartDoc>("Cart", cartSchema);
