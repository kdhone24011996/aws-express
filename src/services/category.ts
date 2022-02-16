import { Model } from "mongoose";
import { ICategory, category } from "../models/Category";
import { CategoryDoc } from "../models/Category";
import { DatabaseService } from "./database";

class Category extends DatabaseService<ICategory, CategoryDoc> {
  constructor(model: Model<CategoryDoc>) {
    super(model);
  }
}

export const categoryService = new Category(category);
