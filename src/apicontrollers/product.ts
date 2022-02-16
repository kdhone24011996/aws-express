import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import { Roles } from "../models/Roles";
import { productService } from "../services/product";
import {
  IProduct,
  IProductCms,
  IProductPreSave,
  ProductDoc,
  ProductType,
} from "../models/Product";
import { IProductImage } from "../models/Product";
import { mongoID } from "../util/apiValidation";
import { flattenObj } from "../util/common";
import { IMeResponse } from "../services/user";
import { Types } from "mongoose";
import { IReview } from "../models/Review";
import { reviewService } from "../services/review";
import { supportedFileTypes } from "../services/database";
import { findIndex } from "lodash";
import { variationService } from "../services/variation";
import { shipRocketService } from "../services/shiprocket";
const router = Router();

router.post(
  "/",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("name", "name is required").notEmpty().run(req);
    await check("media", "media are required").isArray().run(req);
    await check("image", "image is required").notEmpty().run(req);
    await check("price", "price is required").isNumeric().run(req);
    await check("availableQuantity", "availableQuantity is required")
      .isNumeric()
      .run(req);
    await check("cms", "cms is required").notEmpty().run(req);
    await check("type", "type is required").exists().run(req);
    await check("variantOf", "variantOf must be a mongoId")
      .optional()
      .customSanitizer(mongoID)
      .run(req);
    await check("categories", "categories is required")
      .isArray({
        min: 1,
      })
      .run(req);
    await apiValidation(req, res);
    try {
      const name: string = req.body.name;
      const image = req.body.image;
      const media = req.body.media;
      const price: number = req.body.price;
      const sku: string = req.body.sku;
      const availableQuantity: number = req.body.availableQuantity || 0;
      const cms: string = req.body.cms || {};
      const discount: number = req.body.discount || 0;
      const categories: any = req.body.categories;
      const properties: {} = req.body.properties || {};
      const uploadedMediaArr = [];
      const similarTo = req.body.similarTo || [];
      const relatedTo = req.body.relatedTo || [];
      const type = req.body.type;
      const variantOf = req.body.variantOf;
      const size = req.body.size;
      const metaData = req.body.metaData;
      const whatsInIt = req.body.cms.whatsInIt;
      const howToUse = req.body.cms.howToUse;
      const subTitle = req.body.cms.subTitle;
      const whatIsIt = req.body.cms.whatIsIt;
      if (type !== ProductType.VARIANT && type !== ProductType.SIMPLE) {
        throw new Error(
          `type should be one of ${ProductType.VARIANT} or ${ProductType.SIMPLE}`
        );
      }
      if (type === ProductType.VARIANT && !variantOf) {
        throw new Error("variantOf property is required for a variant product");
      }
      let uploadedImage;
      if (image.url && image.key) {
        uploadedImage = image;
      } else {
        //upload main image
        const sub = image.file.slice(0, 10);
        if (sub !== "data:image") {
          throw new Error("image is not of base 64 type");
        }
        uploadedImage = await productService.uploadMedia(
          image.file,
          image.fileName,
          supportedFileTypes.IMAGE
        );
        if (!uploadedImage) {
          throw new Error("image upload failed");
        }
      }

      // upload rest of the images
      for (let fileData of media) {
        // console.log(image);
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
          uploadedImage = await productService.uploadMedia(
            fileData.file,
            fileData.fileName,
            supportedFileTypes.MEDIA
          );
        }
        if (uploadedImage) {
          uploadedMediaArr.push(uploadedImage);
        }
      }

      if (uploadedMediaArr.length !== media.length) {
        throw new Error("Image Upload failed");
      }
      logger.debug("media", uploadedMediaArr);

      const data: IProductPreSave = {
        sku,
        name,
        price,
        image: uploadedImage,
        media: uploadedMediaArr,
        availableQuantity,
        discount,
        categories,
        properties,
        aggregateRating: {
          ratingValue: 0,
          ratingCount: 0,
        },
        similarTo,
        relatedTo,
        type,
        cms: {
          subTitle,
          whatIsIt,
          howToUse,
          whatsInIt,
        },
      };
      if (size) data.size = size;
      if (metaData) data.metaData = metaData;
      if (type === ProductType.VARIANT) {
        data.variantOf = variantOf;
      }
      const product: ProductDoc = await productService.create(data);
      productService.updateSimilarProductsAndRelatedProducts(
        product._id,
        similarTo,
        relatedTo
      );
      if (type === ProductType.VARIANT) {
        const response = await variationService.addNewVariant(
          variantOf,
          product
        );
        const re = await shipRocketService.addProduct(product);
        if (response) {
          apiOk(res, product);
        }
      } else {
        apiOk(res, product);
      }
      // res.send(re);
    } catch (error) {
      console.log("hello");
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const filter: any = req.query.filter;
    // console.log(JSON.parse);
    // logger.debug("filter", filter);
    // console.log(filter);
    perPage = parseInt(perPage as string);
    page = parseInt(page as string);
    try {
      let products;

      let cond = {};
      // each category is in category is seperated by ,(comma)
      if (filter) {
        const parsedFilter = JSON.parse(filter);

        console.log(parsedFilter);

        if (
          (parsedFilter.$and &&
            parsedFilter.$and.findIndex((item: Object) =>
              item.hasOwnProperty("categories")
            ) !== -1) ||
          (parsedFilter.$or &&
            parsedFilter.$or.findIndex((item: Object) =>
              item.hasOwnProperty("categories")
            ) !== -1)
        ) {
          console.log("hello");
          let value: any;
          let categoriesFilter;
          const categoryConditionArr: any = [];
          if (parsedFilter.$and) {
            categoriesFilter = parsedFilter.$and
              .filter((item: Object) => item.hasOwnProperty("categories"))
              .pop().categories;
          } else {
            categoriesFilter = parsedFilter.$or
              .filter((item: Object) => item.hasOwnProperty("categories"))
              .pop().categories;
          }
          // const idx = parsedFilter.findIndex((item: Object) =>
          //   item.hasOwnProperty("categories")
          // );
          logger.debug("categoriesFilter", categoriesFilter.$in);
          if (categoriesFilter.$eq) {
            value = new RegExp(`^\/?${categoriesFilter.$eq}\/?`);
          } else if (categoriesFilter.$in) {
            console.log("205", categoriesFilter.$in);
            categoriesFilter.$in.forEach((item: string) => {
              console.log(item);
              categoryConditionArr.push(new RegExp(`^\/?${item}\/?`));
            });
            value = categoryConditionArr;
          }
          if (parsedFilter.$and) {
            const idx = parsedFilter.$and.findIndex((item: Object) =>
              item.hasOwnProperty("categories")
            );
            if (categoriesFilter.$eq) {
              parsedFilter.$and[idx].categories = value;
            } else {
              parsedFilter.$and[idx].categories.$in = value;
            }
          } else if (parsedFilter.$or) {
            const idx = parsedFilter.$or.findIndex((item: Object) =>
              item.hasOwnProperty("categories")
            );
            if (categoriesFilter.$eq) {
              parsedFilter.$or[idx].categories.$eq = value;
            } else {
              parsedFilter.$or[idx].categories.$in = value;
            }
          }
        }
        cond = parsedFilter;
      }

      logger.debug(cond);

      products = await productService.find(cond, page, perPage);
      apiOk(res, products);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/search",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const category = req.query.category || "";
    const name = req.query.name || "";
    perPage = parseInt(perPage as string);
    page = parseInt(page as string);
    try {
      let products;
      const nameCond = new RegExp(`${name}(\w+)?(\s\w+)?`, "i");
      let cond: any = {
        $or: [
          {
            name: nameCond,
          },
          {
            categories: nameCond,
          },
        ],
      };
      if (category) {
        const categoryCond = new RegExp(`${category}\/?`, "i");
        cond = {
          $and: [
            {
              categories: categoryCond,
            },
            {
              name: nameCond,
            },
          ],
        };
      }

      logger.debug(cond, "cond");
      products = await productService.find(cond, page, perPage);
      apiOk(res, products);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);

    apiValidation(req, res);

    try {
      const result = await productService.findProductById(req.params.id);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.delete(
  "/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);

    apiValidation(req, res);

    try {
      const result = await productService.deleteProduct(req.params.id);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/updateProductDetails/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await apiValidation(req, res);

    try {
      const id: string = req.params.id;

      const product = await productService.findById(id);

      const {
        name = product.name,
        price = product.price,
        availableQuantity = product.availableQuantity,
        sku = product.sku,
        discount = product.discount,
        similarTo = product.similarTo,
        relatedTo = product.relatedTo,
        inStock = product.inStock,
        properties = product.properties,
        metaData = product.metaData,
        size = product.size,
        cms = product.cms,
      } = req.body;
      // const cms:IProductCms = {
      //   whatIsIt:
      // }
      const obj: Partial<IProduct> = {
        inStock,
        sku,
        name,
        cms,
        availableQuantity,
        price,
        properties,
        discount,
        similarTo,
        relatedTo,
        metaData,
        size,
      };

      const updatedProduct: ProductDoc = await productService.update(id, obj);
      productService.updateSimilarProductsAndRelatedProducts(
        updatedProduct._id,
        similarTo,
        relatedTo
      );
      apiOk(res, updatedProduct);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/updateProductMainImage/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("file", "file is required").exists().run(req);
    await check("fileName", "fileName is required").exists().run(req);
    apiValidation(req, res);

    try {
      const id: string = req.params.id;
      const file = req.body.file;
      const fileName = req.body.fileName;

      const product = await productService.findById(id);
      const previousImage = product.image;
      const sub = file.slice(0, 10);
      if (sub !== "data:image") {
        throw new Error("api is not of base 64 type");
      }
      const uploadedImage = await productService.uploadMedia(
        file,
        fileName,
        supportedFileTypes.IMAGE
      );

      if (!uploadedImage) {
        throw new Error("Image Upload failed");
      }

      const update: Partial<IProduct> = {
        image: uploadedImage,
      };
      const updatedProduct = await productService.update(id, update);
      await productService.deleteImage(previousImage.key);
      apiOk(res, updatedProduct);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/updateProductMedia/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("file", "file is required").exists().run(req);
    await check("fileName", "fileName is required").exists().run(req);
    await check("previousImageKey", "previousImageKey is required")
      .exists()
      .run(req);
    apiValidation(req, res);

    try {
      const id: string = req.params.id;
      const file = req.body.file;
      const fileName = req.body.fileName;
      const previousImageKey = req.body.previousImageKey as string;

      const product = await productService.findById(id);

      const media = product.media;
      const idx = media.findIndex((item) => item.key === previousImageKey);
      if (idx === -1) {
        throw new Error(
          `product with id ${id} does not contain an image with key ${previousImageKey}`
        );
      }
      const deleteImageResonse = await productService.deleteImage(
        previousImageKey
      );
      const sub = file.slice(0, 5);
      if (sub !== "data:") {
        throw new Error("api is not of base 64 type");
      }
      const uploadedImage = await productService.uploadMedia(
        file,
        fileName,
        supportedFileTypes.MEDIA
      );

      if (!uploadedImage) {
        throw new Error("Image Upload failed");
      }

      const newImages = [];
      for (let file of media) {
        if (file.key === previousImageKey) {
          newImages.push(uploadedImage);
        } else {
          newImages.push(file);
        }
      }
      const update: Partial<IProduct> = {
        media: newImages,
      };
      const updatedProduct = await productService.update(id, update);
      logger.debug("image", file);
      apiOk(res, updatedProduct);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.delete(
  "/deleteProductImage/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("key", "key is required").exists().run(req);
    apiValidation(req, res);

    const key = req.body.key;
    const id = await req.params.id;
    try {
      const product = await productService.findById(id);
      const media = product.media;
      const newImages = media.filter((item) => item.key !== key);
      if (newImages.length === media.length) {
        throw new Error(
          `product with id ${id} does not contain an image with key ${key} d`
        );
      }
      const deleteResponse = await productService.deleteImage(key);
      const update: Partial<IProduct> = {
        media: newImages,
      };
      const updatedProduct = await productService.update(id, update);
      apiOk(res, updatedProduct);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.post(
  "/addNewProductMedia",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("productId", "productId is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("file", "file is required").exists().run(req);
    await check("fileName", "fileName is required").exists().run(req);
    const productId = req.body.productId;
    const file = req.body.file;
    const fileName = req.body.fileName;
    try {
      const product = await productService.findById(productId);
      const media = product.media;

      const sub = file.slice(0, 5);
      if (sub !== "data:") {
        throw new Error("file is not of base 64 type");
      }
      const uploadedImage = await productService.uploadMedia(
        file,
        fileName,
        supportedFileTypes.MEDIA
      );
      if (!uploadedImage) {
        throw new Error("file upload failed");
      }
      media.push(uploadedImage);
      const update: Partial<IProduct> = {
        media,
      };
      const updatedProduct = await productService.update(productId, update);
      apiOk(res, updatedProduct);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.post(
  "/review/:id",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("message", "message is required").isString().run(req);
    await check("rating", "rating is required").isNumeric().run(req);
    apiValidation(req, res);
    const user = req.user as IMeResponse;
    const id = req.params.id as string;
    const message: string = req.body.message;
    const rating = req.body.rating as number;
    logger.debug("id", id);
    console.log(id);
    const reviewObj: IReview = {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      product: new Types.ObjectId(id),
      message: message,
      rating: rating,
    };
    try {
      const product = await productService.findById(id);
      logger.debug("product", product);
      const reviewResponse = await reviewService.create(reviewObj);
      //update aggregate rating and rating count
      if (!product.aggregateRating) {
        product.aggregateRating = {
          ratingCount: 0,
          ratingValue: 0,
        };
      }
      let ratingCount = product.aggregateRating?.ratingCount || 0;
      let ratingValue = product.aggregateRating?.ratingValue || 0;
      ratingCount += 1;
      const newRatingValue =
        (ratingValue * (ratingCount - 1) + rating) / ratingCount;
      product.aggregateRating.ratingCount = ratingCount;
      product.aggregateRating.ratingValue = newRatingValue;
      const response = await product.save();
      apiOk(res, response);
    } catch (err) {
      apiError(res, err, 500);
    }
  })
);

router.get(
  "/review/:id",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);

    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const id = req.params.id;

    perPage = parseInt(perPage as string);
    page = parseInt(page as string);

    try {
      const response = await reviewService.find({ product: id }, page, perPage);
      apiOk(res, response);
    } catch (err) {
      apiError(res, err);
    }
  })
);

router.put(
  "/review/:productId/:reviewId",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("productId", "productId is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("reviewId", "reviewId is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("message", "message is required").isString().run(req);
    await check("rating", "rating is required").isNumeric().run(req);
    apiValidation(req, res);
    const user = req.user as IMeResponse;
    const productId = req.params.productId as string;
    const reviewId = req.params.reviewId as string;
    const message: string = req.body.message;
    const rating = req.body.rating as number;
    const reviewObj: IReview = {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      product: new Types.ObjectId(productId),
      message: message,
      rating: rating,
    };
    try {
      //get review of the user for the product
      const review = await reviewService.findById(reviewId);

      logger.debug("Review data", review);
      if (review.user.id !== user.id) {
        throw new Error(
          `reiviewId ${reviewId} does not belongs to the user with userId ${user.id}`
        );
      }
      console.log(review.product._id);
      console.log(productId);
      if (review.product._id.toString() !== productId.toString()) {
        throw new Error(
          `reiviewId ${reviewId} does not belongs to the product with productId ${productId}`
        );
      }
      const previousRatingValue = review.rating;

      const product = await productService.findById(productId);
      // logger.debug("product", product);
      const ratingCount = product.aggregateRating.ratingCount;
      let ratingValue = product.aggregateRating.ratingValue;
      ratingValue =
        (ratingValue * ratingCount - previousRatingValue + rating) /
        ratingCount;
      product.aggregateRating.ratingValue = ratingValue;
      const productResponse = await product.save();
      const reviewResponse = await reviewService.update(review.id, reviewObj);
      apiOk(res, reviewResponse);
    } catch (err) {
      apiError(res, err, 500);
    }
  })
);

export default router;
