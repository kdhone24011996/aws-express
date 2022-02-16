import { Document, model, Schema, Types } from "mongoose";

export interface IReview {
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  product: Types.ObjectId;
  message: string;
  rating: number;
}

export interface ReviewDoc extends IReview, Document {}

const schemaFields: Record<keyof IReview, any> = {
  user: {
    id: String,
    firstName: String,
    lastName: String,
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
  },
  message: { type: String, required: true },
  rating: { type: Number, required: true },
};

const schema = new Schema(schemaFields, { timestamps: true });

export const Review = model<ReviewDoc>("Review", schema);
