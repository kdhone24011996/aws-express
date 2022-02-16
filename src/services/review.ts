import { Model } from "mongoose";
import { IReview, Review, ReviewDoc } from "../models/Review";
import { ICategory, category } from "../models/Category";
import { CategoryDoc } from "../models/Category";
import { DatabaseService } from "./database";

class Category extends DatabaseService<IReview, ReviewDoc> {
  constructor(model: Model<ReviewDoc>) {
    super(model);
  }
}

export const reviewService = new Category(Review);
