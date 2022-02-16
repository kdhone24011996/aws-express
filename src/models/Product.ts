import mongoose, { Document, model, Schema, Types } from "mongoose";
import logger from "../util/logger";

const slug = require("mongoose-slug-generator");
mongoose.plugin(slug);

export interface IProductPrice {
  originalPrice: number;
  afterDiscountPrice: number;
}

export interface ISize {
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface IProductImage {
  url: string;
  key: string;
}

export enum ProductType {
  SIMPLE = "Simple",
  VARIANT = "Variant",
}

export interface IProduct extends IProductPreSave {
  inStock: boolean;
  finalPrice: number;
}

export interface IProductCms {
  whatIsIt: string;
  howToUse?: string;
  whatsInIt?: string;
  subTitle?: String;
}

export interface IProductPreSave {
  sku: string;
  name: string;
  slug?: string;
  image: IProductImage;
  media: IProductImage[];
  availableQuantity: number;
  discount?: number;
  price: number;
  categories: [string];
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
  };
  relatedTo?: Types.ObjectId[];
  similarTo?: Types.ObjectId[];
  properties: Record<string, any>;
  type: ProductType;
  variantOf?: Types.ObjectId;
  size?: ISize;
  metaData?: {
    keywords: string[];
    description: string;
    title: string;
  };
  cms: IProductCms;
}

export interface ProductDoc extends IProduct, Document {
  _doc: any;
}
const schemaFields: Record<keyof IProduct, any> = {
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, slug: "name", unique: true },
  image: {
    required: true,
    type: {
      url: { type: String },
      key: { type: String },
    },
  },
  media: {
    required: true,
    type: [
      {
        url: { type: String },
        key: { type: String },
      },
    ],
  },
  availableQuantity: { type: Number, required: true },
  inStock: { type: Boolean, required: false },
  discount: { type: Number, default: 0 },
  price: Number,
  finalPrice: { type: Number },
  categories: { type: [String], required: true },
  properties: {},
  aggregateRating: {
    type: {
      ratingValue: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
  },
  relatedTo: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  similarTo: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  type: {
    type: String,
    enum: Object.values(ProductType),
    default: false,
  },
  variantOf: {
    type: Schema.Types.ObjectId,
    ref: "Product",
  },
  size: {
    length: { type: Number, default: 0 },
    breadth: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },
  },
  metaData: {
    keywords: { type: [String], default: [] },
    description: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  cms: {
    whatIsIt: { type: String, required: true },
    howToUse: { type: String, default: "" },
    whatsInIt: { type: String, default: "" },
    subTitle: { type: String, default: "" },
  },
};

const schema = new Schema(schemaFields, { timestamps: true });

schema.pre("save", function (next) {
  const product = this;
  const originalPrice = product.price;
  const availableQuantity = product.availableQuantity;
  const finalPrice = originalPrice - product.discount;
  product.finalPrice = finalPrice;
  logger.debug(product.price);
  logger.debug(finalPrice);
  if (availableQuantity > 0) {
    product.inStock = true;
  } else {
    product.inStock = false;
  }
  next();
});

schema.index({ categories: 1 });
export const Product = model<ProductDoc>("Product", schema);
