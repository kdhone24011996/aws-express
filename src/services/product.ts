import { Model, startSession, Types } from "mongoose";
import { generateRandomDigits } from "../util/common";
import {
  IProductImage,
  IProductPreSave,
  ProductDoc,
  ProductType,
} from "../models/Product";
import { Product } from "../models/Product";
import { IProduct } from "../models/Product";
import { DatabaseService } from "./database";
import { s3 } from "../config/aws";
import logger from "../util/logger";
import { variationService } from "./variation";

class ProductService extends DatabaseService<IProductPreSave, ProductDoc> {
  constructor(model: Model<ProductDoc>) {
    super(model);
  }

  public async listAll(page: number, perPage: number) {
    const response = this.find({}, page, perPage);
    return response;
  }

  public async deleteProduct(id: string) {
    const product = await this.findById(id);
    console.log("hellooo");
    const session = await startSession();
    await session.startTransaction();
    if (product.type === ProductType.VARIANT) {
      // delete the this product from the variation
      const variation = await variationService.findById(
        product.variantOf.toString()
      );
      console.log("hiiii");
      // console.log("variation", variation);
      console.log("id", id);
      const attributes = variation.attributes;
      attributes.forEach((item) => {
        // console.log("item", item);
        const values = [...item.values];
        values.forEach((value, index) => {
          console.log("valueProducts", value.products);
          const productIndex = value.products.findIndex(
            (item) => item.toString() === id.toString()
          );
          if (productIndex !== -1) {
            console.log("index", index);
            item.values[index].products.splice(productIndex, 1);
            if (item.values[index].products.length === 0) {
              item.values.splice(index, 1);
            }
          }
        });
      });
      await variation.save({ session });
    }
    const response = await this.delete(id, product, { session });
    await session.commitTransaction();
    return response;
  }

  public async findProductById(productId: string) {
    const response = this.findById(productId, [
      { path: "relatedTo" },
      { path: "similarTo" },
    ]);
    return response;
  }

  public async updateSimilarProductsAndRelatedProducts(
    productId: Types.ObjectId,
    similarTo: [string],
    relatedTo: [string]
  ) {
    if (similarTo.length > 0) {
      const response = await this.find({
        _id: {
          $in: similarTo,
        },
      });
      logger.debug("response", response);
      const data = response.data;
      for (let item of data) {
        const idx = item.similarTo.indexOf(productId);
        if (idx === -1) {
          item.similarTo.push(productId);
          await item.save();
        }
      }
    }

    if (relatedTo.length > 0) {
      const response = await this.find({
        _id: {
          $in: relatedTo,
        },
      });
      logger.debug("response", response);
      const data = response.data;
      for (let item of data) {
        const idx = item.relatedTo.indexOf(productId);
        if (idx === -1) {
          item.relatedTo.push(productId);
          await item.save();
        }
      }
    }
  }
}

export const productService = new ProductService(Product);
