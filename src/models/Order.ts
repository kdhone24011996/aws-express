import { Document, model, Schema } from "mongoose";
import { IProduct, ISize } from "./Product";
import { IAddress } from "./User";

export enum orderStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum cfOrderStatus {
  ACTIVE = "ACTIVE",
  PAID = "PAID",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum paymentMethod {
  PREPAID = "Prepaid",
  COD = "Cod",
}

export enum transactionStatus {
  FAILED = "FAILED",
  SUCCESS = "SUCCESS",
}
export enum shippingStatus {
  SHIPPED = 6,
  DELIVERED = 7,
  CANCELLED = 8,
  LOST = 12,
  OUT_FOR_DELIVERY = 17,
  IN_TRANSIENT = 18,
  OUT_FOR_PICKUP = 19,
}
export interface IOrderItem {
  _id: string;
  sku: string;
  name: string;
  slug: String;
  image: {
    url: string;
    key: string;
  };
  description: string;
  discount: number;
  price: number;
  finalPrice: number;
  categories: string[];
  quantity: number;
  size: ISize;
}

export interface IOrderAppliedCoupons {
  coupon: {
    name: string;
    code: string;
    description: string;
  };
  totalDiscount: number;
}

export interface IOrder {
  products: IOrderItem[];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  shippingAddress: IAddress;
  totalPrice: number;
  status?: orderStatus;
  appliedCoupons?: IOrderAppliedCoupons[];
  shiprocket_order_id?: number | null;
  paymentDetails?: {
    paymentMethod?: paymentMethod;
    cfDetails?: {
      cfOrderDetail: {
        cf_order_id: string;
        order_token: string;
        order_status: string;
      };
      cfTransactionDetails: any;
    };
  };
  shippingDetails?: any;
  cancelNote?: string;
}

export interface orderDoc extends IOrder, Document {}

const schemaFields: Record<keyof IOrder, any> = {
  products: [
    {
      _id: Schema.Types.ObjectId,
      sku: { type: String, required: true },
      name: { type: String, required: true },
      slug: String,
      image: {
        url: { type: String },
        key: { type: String },
      },
      description: { type: String, required: true },
      discount: { type: Number },
      price: Number,
      finalPrice: { type: Number },
      categories: { type: [String], required: true },
      quantity: Number,
      size: {
        length: { type: Number, default: 0 },
        breadth: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        weight: { type: Number, default: 0 },
      },
    },
  ],
  user: {
    id: String,
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
  },
  shippingAddress: {
    required: true,
    type: {
      name: String,
      phoneNumber: String,
      line1: String,
      line2: String,
      zipCode: Number,
      city: String,
      state: String,
      country: String,
    },
  },
  totalPrice: Number,
  status: {
    type: String,
    enum: Object.values(orderStatus),
    default: orderStatus.PENDING_PAYMENT,
  },
  appliedCoupons: {
    type: [
      {
        coupon: {
          name: String,
          code: String,
          description: String,
        },
        totalDiscount: Number,
      },
    ],
    default: null,
  },
  shiprocket_order_id: { type: Number, default: null },
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: Object.values(paymentMethod),
      default: paymentMethod.PREPAID,
    },
    cfDetails: {
      cfOrderDetail: {
        cf_order_id: String,
        order_token: String,
        order_status: String,
      },
      cfTransactionDetails: {},
    },
  },
  shippingDetails: {},
  cancelNote: { type: String, default: "" },
};

const schema = new Schema(schemaFields, { timestamps: true });
// schema.index({ name: 1 }, { unique: true });
export const order = model<orderDoc>("Order", schema);
