import { Document, model, PopulatedDoc, Schema, Types } from "mongoose";
import { IAttribute } from "./attribute";

export interface IVariationAttribute {
  attribute: PopulatedDoc<IAttribute & Document>;
  values?: [
    {
      products: Types.ObjectId[];
      attributePropertyValue: string;
    }
  ];
}

export interface IVariation {
  attributes: IVariationAttribute[];
  products: Types.ObjectId[];
}

export enum Level {
  CATEGORY = "Category",
  PRODUCT = "Product",
}

export interface VariationDoc extends IVariation, Document {}
const schemaFields: Record<keyof IVariation, any> = {
  attributes: {
    type: [
      {
        attribute: {
          type: Schema.Types.ObjectId,
          ref: "Attribute",
        },
        values: {
          type: [
            {
              products: [
                {
                  type: Schema.Types.ObjectId,
                  ref: "Product",
                },
              ],
              attributePropertyValue: String,
              _id: false,
            },
          ],
          default: [],
        },
        _id: false,
      },
    ],
  },
  products: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: [],
    unique: true,
  },
};

const variationSchema = new Schema(schemaFields, { timestamps: true });

export const variation = model<VariationDoc>("Variation", variationSchema);
