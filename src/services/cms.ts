import { Model } from "mongoose";
import { DatabaseService, supportedFileTypes } from "./database";
import { attribute, AttributeDoc, IAttribute } from "../models/attribute";
import { cms, CmsDoc, ICms } from "../models/cms";

class Cms extends DatabaseService<ICms, CmsDoc> {
  constructor(model: Model<CmsDoc>) {
    super(model);
  }

  public async uploadBannerImage(fileData: any) {
    let uploadedImage;
    if (fileData.url && fileData.key) {
      uploadedImage = fileData;
    } else {
      const sub = fileData.file.slice(0, 5);
      if (sub !== "data:") {
        throw new Error("file is not of base 64 type");
      }
      if (!fileData.fileName) {
        throw new Error("media file should contain fileName");
      }
      uploadedImage = await this.uploadMedia(
        fileData.file,
        fileData.fileName,
        supportedFileTypes.IMAGE
      );
    }
    if (uploadedImage) return uploadedImage;
    return false;
  }
}

export const cmsService = new Cms(cms);
