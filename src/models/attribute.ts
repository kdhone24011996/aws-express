import { Document, model, Mongoose, ObjectId, Schema, Types } from "mongoose";
import { DisplayType } from "./Category";

export interface IAttribute {
  name: string;
  level: string;
  displayType: DisplayType;
  category?: any;
  options: string[];
}

export enum Level {
  CATEGORY = "Category",
  PRODUCT = "Product",
}

export interface AttributeDoc extends IAttribute, Document {}
const schemaFields: Record<keyof IAttribute, any> = {
  name: { type: String, required: true },
  level: { type: String, required: true, enum: Object.values(Level) },
  displayType: {
    type: String,
    required: true,
    enum: Object.values(DisplayType),
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
  },
  options: { type: Array },
};

const attributeSchema = new Schema(schemaFields, { timestamps: true });

export const attribute = model<AttributeDoc>("Attribute", attributeSchema);
