import { model, Schema, Document, Types } from "mongoose";

export interface IBannerContent {
  _id?: Types.ObjectId;
  name: string;
  image: IBannerImage;
  url: string;
}
export interface IImage {
  url: string;
  key: string;
}

export interface IBannerImage {
  mobile: IImage;
  desktop: IImage;
}
export interface ICms {
  banner: IBannerContent[];
}
export interface CmsDoc extends ICms, Document {}
const schemaFields: Record<keyof ICms, any> = {
  banner: [
    {
      name: { type: String, required: true, unique: true },
      url: { type: String, required: true, unique: true },
      image: {
        mobile: {
          url: { type: String },
          key: { type: String },
        },
        desktop: {
          url: { type: String },
          key: { type: String },
        },
      },
    },
  ],
};

const schema = new Schema(schemaFields, { timestamps: true });

export const cms = model<CmsDoc>("Cms", schema);
