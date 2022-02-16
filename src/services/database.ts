import { IPaginateResult } from "./pagination";
import { model, Schema, Document, Types, Model, startSession } from "mongoose";
import { s3 } from "../config/aws";
import { generateRandomDigits } from "../util/common";

const ID = Types.ObjectId;
export enum DBSort {
  ASCENDING = 1,
  DESCENDING = -1,
}

export enum supportedFileTypes {
  IMAGE = "Image",
  MEDIA = "Media",
}

export class DatabaseService<TData, TDoc extends Document & TData> {
  protected model: Model<TDoc>;
  constructor(model: Model<TDoc>) {
    this.model = model;
  }

  public MY_BUCKET = "econut";

  public async find(
    cond: any,
    page: number = 1,
    perPage: number = 10,
    populate: any[] = [],
    select: any = {},
    sort: Record<string, DBSort> = { createdAt: DBSort.DESCENDING }
  ): Promise<IPaginateResult<TDoc>> {
    if (page < 1) {
      throw Error("Page cannot be smaller than 1");
    }
    if (perPage < 1) {
      throw new Error("perPage cannot be smaller than 1");
    }

    let skip = (page - 1) * perPage;
    skip = page > 1 ? skip - 1 : skip;
    const limit = page > 1 ? perPage + 2 : perPage + 1; // get one extra result for checking more records

    let query = this.model.find(cond);
    for (const p of populate) {
      query = query.populate(p);
    }
    query = query.skip(skip).limit(limit).select(select).sort(sort);
    let users = await query;

    const userCount = users.length;
    const hasPrevious = page > 1 && userCount > 0;
    const lower = hasPrevious ? 1 : 0;

    const hasNext = userCount > perPage + lower;
    const upper = hasNext ? perPage + lower : userCount;

    users = users.slice(lower, upper);

    const totalCount = await this.model.countDocuments(cond);

    const result: IPaginateResult<TDoc> = {
      data: users,
      pagination: {
        hasNext,
        hasPrevious,
        perPage,
        page,
        next: "",
        previous: "",
        totalCount: totalCount,
      },
    };

    return result;
  }

  public async findById(
    Id: string,
    populate: string[] | { path: string; select?: any; options?: any }[] = []
  ) {
    if (!Id) {
      throw new Error("id is invalid");
    }
    const id = new ID(Id);

    const result = await this.find({ _id: id }, 1, 10, populate);
    if (result.data.length === 0) {
      throw new Error(`record with id ${id} not found`);
    }

    const user = result.data[0];
    return user;
  }

  public async update(Id: string, record: Partial<TData>, existing?: TDoc) {
    if (!existing) {
      existing = await this.findById(Id);
    }

    let myrecord = record as any;
    myrecord = this.flattenObj(myrecord);
    const keys = Object.keys(myrecord);
    for (const k of keys) {
      existing.set(k, myrecord[k]);
    }

    const result = await existing.save();
    return result;
  }

  public async create(
    record: TData,
    options: any = {}
  ): Promise<Document<any, any, any> & TDoc> {
    const obj = new this.model();
    let myrecord = record as any;
    myrecord = this.flattenObj(myrecord);
    const keys = Object.keys(myrecord);

    for (const k of keys) {
      obj.set(k, myrecord[k]);
    }

    const result = await this.model.create([obj], options);
    return result[0];
  }

  public async delete(Id: string, existing?: TDoc, options: any = {}) {
    if (!existing) {
      existing = await this.findById(Id);
    }
    const result = await existing.remove(options);
    return result;
  }

  /**
   * This method will delete all the rows which matches to provided condition.
   * @param cond
   * @returns
   **/
  public async deleteByCond(cond: any) {
    const result = await this.model.remove(cond);
    return result;
  }

  // public async imageUpload(base64: any) {
  //   const base64Data = Buffer.from(
  //     base64.replace(/^data:image\/\w+;base64,/, ""),
  //     "base64"
  //   );
  //   const type = base64.split(";")[0].split("/")[1];

  //   const params = {
  //     Bucket: this.MY_BUCKET,
  //     Key: `/${generateRandomDigits(20)}.${type}`, // type is not required
  //     Body: base64Data,
  //     ACL: "public-read",
  //     ContentEncoding: "base64", // required
  //     ContentType: `image/${type}`, // required. Notice the back ticks
  //   };

  //   let location = "";
  //   let key = "";
  //   try {
  //     const { Location, Key } = await s3.upload(params).promise();
  //     location = Location;
  //     key = Key;
  //     //console.log('location', location)
  //     return {
  //       url: location,
  //       key,
  //     };
  //   } catch (error) {
  //     //console.log('error', error)
  //     return false;
  //   }
  // }

  public async deleteImage(key: string) {
    const response = await s3.deleteObject({
      Bucket: this.MY_BUCKET,
      Key: key,
    });
    return response;
  }

  public async uploadMedia(
    base64: any,
    filename: string,
    supportedType: supportedFileTypes
  ) {
    const newBuffer = base64.replace(/^data:.+;base64,/, "");
    const c = base64.split("base64")[0];
    const d = c.replace("data:", "");
    const mimeType = d.replace(";", "");
    const ext = filename.split(".").pop();

    const base64Data = Buffer.from(newBuffer, "base64");
    const fileType = base64.split(";")[0].split("/")[1];
    const finalFileName = filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    // supported file types
    let supported = ["png", "jpg", "jpeg", "svg"];
    // if(supportedType === supportedFileTypes.IMAGE){
    //   const supported = ["png", "jpg", "jpeg"];
    // }
    if (supportedType === supportedFileTypes.MEDIA) {
      supported = ["png", "jpg", "jpeg", "svg", "mp4"];
    }

    const fileSupported: boolean =
      supported.includes(fileType) || supported.includes(ext);
    if (!fileSupported) {
      throw new Error(`File with extension ${fileType} is not supported.`);
    }

    const params = {
      Bucket: this.MY_BUCKET,
      Key: `${generateRandomDigits(20)}_${finalFileName}.${ext}`, // type is not required
      Body: base64Data,
      ACL: "public-read",
      ContentEncoding: "base64", // required
      ContentType: mimeType, // required. Notice the back ticks
    };

    let location = "";
    let key = "";
    try {
      const { Location, Key } = await s3.upload(params).promise();
      location = Location;
      key = Key;
      //console.log('location', location)
      return {
        url: location,
        key,
      };
    } catch (error) {
      //console.log('error', error)
      return false;
    }
  }

  private isPlainObj(o: any) {
    let result =
      o &&
      o.constructor &&
      o.constructor.prototype &&
      o.constructor.prototype.hasOwnProperty("isPrototypeOf");
    result = Boolean(result);
    return result;
  }

  private flattenObj(obj: any, keys: string[] = []): any {
    return Object.keys(obj).reduce((acc, key) => {
      return Object.assign(
        acc,
        this.isPlainObj(obj[key])
          ? this.flattenObj(obj[key], keys.concat(key))
          : { [keys.concat(key).join(".")]: obj[key] }
      );
    }, {});
  }
}
