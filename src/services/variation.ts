import { Model, Types } from "mongoose";
import { DatabaseService } from "./database";
import { IVariation, variation, VariationDoc } from "../models/variation";
import { ProductDoc } from "../models/Product";
import { attributeService } from "./attribute";
import logger from "../util/logger";

class Variation extends DatabaseService<IVariation, VariationDoc> {
  constructor(model: Model<VariationDoc>) {
    super(model);
  }

  public async createVarition(attributes: Types.ObjectId[]) {
    const attributeArr = [] as any;
    for (let attribute of attributes) {
      attributeArr.push({
        values: [],
        attribute,
      });
    }
    const postObj: IVariation = {
      attributes: attributeArr,
      products: [],
    };
    const response = await super.create(postObj);
    return response;
  }
  public async addNewAttributes(id: string, attributes: Types.ObjectId[]) {
    const variation = await this.findById(id);

    const attributeArr = [...variation.attributes];
    for (let attribute of attributes) {
      attributeArr.push({
        attribute,
      });
    }
    variation.attributes = attributeArr;
    const response = await variation.save();
    return response;
  }

  public async addNewVariant(variationId: string, product: ProductDoc) {
    const variation = await this.findById(variationId, [
      { path: "attributes.attribute", select: "name" },
    ]);
    const attributes = variation.attributes;
    logger.debug(variation);
    for (const attr of attributes) {
      const name = attr.attribute.name;
      console.log(attr.values);
      const idx = attr.values.findIndex(
        (value) => value.attributePropertyValue === product.properties[name]
      );

      console.log("idx", idx);
      console.log(product.properties[name]);
      console.log(product);
      if (idx !== -1) {
        // if propertyValue has entry in the current attribute then add this product to the products array of the same attribute
        attr.values[idx].products.push(product._id.toString());
      } else {
        // create entry of the property value in the current attribute
        attr.values.push({
          products: [product._id.toString()],
          attributePropertyValue: product.properties[name],
        });
      }
    }
    // throw new error("flkf");
    console.log(variation.products);
    const idx = variation.products.indexOf(product._id.toString());
    if (idx === -1) {
      variation.products.push(product._id);
    }
    const response = await variation.save();
    return response;
  }
}

export const variationService = new Variation(variation);
