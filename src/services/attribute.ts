import { Model } from "mongoose";
import { DatabaseService } from "./database";
import { attribute, AttributeDoc, IAttribute } from "../models/attribute";

class Attribute extends DatabaseService<IAttribute, AttributeDoc> {
  constructor(model: Model<AttributeDoc>) {
    super(model);
  }
}

export const attributeService = new Attribute(attribute);
