import { NextFunction, Request, Router, Response, response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import { Roles } from "../models/Roles";
import { categoryService } from "../services/category";
import { mongoID } from "../util/apiValidation";
import { ICategory } from "../models/Category";
import { productService } from "../services/product";
import { supportedFileTypes } from "../services/database";
const router = Router();

router.post(
  "/",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("name", "name is required").exists().run(req);
    await check("parent", "parent is required").exists().run(req);
    await check("image", "image is required").exists().run(req);
    await check("filters", "filters must be the array").isArray().run(req);
    apiValidation(req, res);

    try {
      const name = req.body.name;
      const parent = req.body.parent;
      const image = req.body.image;
      const icon = req.body.icon;
      const whiteIcon = req.body.whiteIcon;
      const regEx = new RegExp(`\/$`); //checks if the "/" is the last caracter of string

      const category = `${parent}${regEx.test(parent) ? "" : "/"}${name}`;
      const filters = req.body.filters;

      // image upload
      const sub = image.file.slice(0, 10);
      if (sub !== "data:image") {
        throw new Error("image is not of base 64 type");
      }
      const uploadedImage = await productService.uploadMedia(
        image.file,
        image.fileName,
        supportedFileTypes.IMAGE
      );
      if (!uploadedImage) {
        throw new Error("Image Upload failed");
      }
      logger.debug("image", image);

      let uploadedIcon: any = "";
      let uploadedWhiteIcon: any = "";
      if (icon) {
        // icon upload
        const sub = icon.file.slice(0, 10);
        if (sub !== "data:image") {
          throw new Error("image is not of base 64 type");
        }
        uploadedIcon = await productService.uploadMedia(
          icon.file,
          icon.fileName,
          supportedFileTypes.IMAGE
        );
      }
      if (whiteIcon) {
        // white icon upload
        const sub = whiteIcon.file.slice(0, 10);
        if (sub !== "data:image") {
          throw new Error("image is not of base 64 type");
        }
        uploadedWhiteIcon = await productService.uploadMedia(
          icon.file,
          icon.fileName,
          supportedFileTypes.IMAGE
        );
      }
      const data = {
        image: uploadedImage,
        name,
        parent,
        category,
        filters,
      } as ICategory;

      if (uploadedIcon) {
        data.icon = uploadedIcon;
      }
      if (whiteIcon) {
        data.whiteIcon = whiteIcon;
      }
      const response = await categoryService.create(data);
      if (response) {
        apiOk(res, response);
      }
    } catch (err) {
      apiError(res, err, 500);
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

    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    const filter: any = req.query.filter;
    let cond = {};
    if (filter) {
      cond = JSON.parse(filter);
    }
    try {
      const response = await categoryService.find(cond, page, perPage);
      apiOk(res, response);
    } catch (err) {
      apiError(res, err, 500);
    }
  })
);
router.get(
  "/hierarchy",
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

    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    try {
      const response = await categoryService.find(
        {
          parent: "/",
        },
        page,
        perPage,
        [],
        "name category parent image icon"
      );
      const allParentCategories = response.data;
      const categories = [];
      for (let parentCategory of allParentCategories) {
        const childResponse = await categoryService.find(
          {
            parent: parentCategory.category,
          },
          page,
          perPage,
          [],
          "name category parent"
        );
        const childCategories = childResponse.data;
        categories.push({
          ...parentCategory.toJSON(),
          childCategories,
        });
      }
      apiOk(res, categories);
    } catch (err) {
      apiError(res, err, 500);
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
    await check("name", "name is required and must be a string")
      .isString()
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const name = req.query.name || ("" as string);
    perPage = parseInt(perPage as string);
    page = parseInt(page as string);
    logger.debug("name", name);
    console.log("name", name);
    try {
      const categoryCond = new RegExp(`${name}\/?`, "i");
      let cond: any = {
        category: categoryCond,
      };
      logger.debug(cond, "cond");
      const categories = await categoryService.find(cond, page, perPage);
      apiOk(res, categories);
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
      const response = await categoryService.findById(req.params.id);
      // console.log(response);

      const category = response.category;
      const regEx = new RegExp(`^${category}\/?`);
      const success = await categoryService.deleteByCond({
        category: regEx,
      });
      console.log(success);
      apiOk(res, success);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.patch(
  "/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("filters", "filters must be the array").isArray().run(req);
    apiValidation(req, res);

    try {
      if (req.body.name) {
        throw new Error("Name is not a changable propery");
      }
      if (req.body.parent) {
        throw new Error("Parent is not a changable propery");
      }

      const record: Partial<ICategory> = {
        filters: req.body.filters,
      };

      const success = await categoryService.update(req.params.id, record);
      console.log(success);
      apiOk(res, success);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/updateCategoryImage/:id",
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
      const { file, fileName } = req.body;

      const category = await categoryService.findById(id);
      const previousImage = category.image;
      const sub = file.slice(0, 10);
      if (sub !== "data:image") {
        throw new Error("api is not of base 64 type");
      }
      const uploadedImage = await categoryService.uploadMedia(
        file,
        fileName,
        supportedFileTypes.IMAGE
      );

      if (!uploadedImage) {
        throw new Error("Image Upload failed");
      }

      const update: Partial<ICategory> = {
        image: uploadedImage,
      };
      const updatedCategory = await categoryService.update(id, update);
      await categoryService.deleteImage(previousImage.key);
      apiOk(res, updatedCategory);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);
router.put(
  "/updateCategoryIcon/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    await check("file", "file is required").exists().run(req);
    await check("fileName", "fileName is required").exists().run(req);
    apiValidation(req, res);

    let iconName: string = "icon";
    let iconType = req.query.type || "";
    if (iconType === "white") {
      iconName = "whiteIcon";
    }
    try {
      const id: string = req.params.id;
      const { file, fileName } = req.body;

      const category = await categoryService.findById(id);
      const previousIcon = category.get(iconName);
      const sub = file.slice(0, 10);
      if (sub !== "data:image") {
        throw new Error("api is not of base 64 type");
      }
      const uploadedIcon = await categoryService.uploadMedia(
        file,
        fileName,
        supportedFileTypes.IMAGE
      );

      if (!uploadedIcon) {
        throw new Error("Image Upload failed");
      }

      const update: Partial<ICategory> = {
        [iconName]: uploadedIcon,
      };
      const updatedCategory = await categoryService.update(id, update);
      await categoryService.deleteImage(previousIcon.key);
      apiOk(res, updatedCategory);
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
      const result = await categoryService.findById(req.params.id);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);
export default router;
