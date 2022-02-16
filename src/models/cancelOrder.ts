import { Document, model, Mongoose, ObjectId, Schema, Types } from "mongoose";
import { DisplayType } from "./Category";

export enum cancelOrderStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
export interface ICancelOrder {
  order: Types.ObjectId;
  reason: string;
  status?: cancelOrderStatus;
}

export interface CancelOrderDoc extends ICancelOrder, Document {}
const schemaFields: Record<keyof ICancelOrder, any> = {
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    unique: true,
  },
  reason: { type: String, required: true },
  status: {
    type: String,
    default: cancelOrderStatus.PENDING,
    enum: Object.values(cancelOrderStatus),
  },
};

const cancelOrderSchema = new Schema(schemaFields, { timestamps: true });

export const cancelOrder = model<CancelOrderDoc>(
  "CancelOrder",
  cancelOrderSchema
);
