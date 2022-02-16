import { model, Schema, Document } from "mongoose";

export enum ComparisonType {
  GREATER_THAN = "$gt",
  GREATER_THAN_EQUAL = "$gte",
  LESS_THAN = "$lt",
  LESS_THAN_EQUAL = "$lte",
  EQUAL = "$eq",
}

export enum DisplayType {
  SELECT = "Select",
  COLOR = "Color",
}

export interface ICategoryFilter {
  name: String;
  displayType: DisplayType;
  filters: any[];
}
export interface ICategoryImage {
  url: string;
  key: string;
}
export interface ICategory {
  name: string; // shirt
  image?: ICategoryImage;
  icon?: ICategoryImage;
  whiteIcon?: ICategoryImage;
  category: string; // /clothes/shirt
  parent: string; //  /electronics
  filters?: ICategoryFilter[]; // { size:["s","m","lg","xl", "xxl"] }
}
export interface CategoryDoc extends ICategory, Document {}
const schemaFields: Record<keyof ICategory, any> = {
  name: { type: String, required: true, unique: true },
  image: {
    url: { type: String },
    key: { type: String },
  },
  icon: {
    url: { type: String },
    key: { type: String },
  },
  whiteIcon: {
    url: { type: String },
    key: { type: String },
  },
  category: { type: String, required: true },
  parent: { type: String, required: true },
  filters: {
    type: [
      {
        name: { type: String },
        displayType: {
          type: String,
          enum: Object.values(DisplayType),
        },
        options: {
          type: [String],
          required: true,
          index: true,
        },
        _id: false,
      },
    ],
  },
};

const schema = new Schema(schemaFields, { timestamps: true });

schema.pre("validate", function validate(next) {
  var unique = [];

  for (var i = 0, l = this.filters.length; i < l; i++) {
    let prop = this.filters[i].name.toLowerCase();

    if (prop && unique.indexOf(prop) > -1) {
      return next(new Error("Duplicated sub document!"));
    }
    unique.push(prop);
  }

  next();
});
schema.index({ name: 1 }, { unique: true });
export const category = model<CategoryDoc>("Category", schema);
