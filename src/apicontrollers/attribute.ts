import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import { Authenticate, Authorize } from "../config/auth";
import { mongoID } from "../util/apiValidation";
import { IAttribute, Level } from "../models/attribute";
import { attributeService } from "../services/attribute";
import { Roles } from "../models/Roles";
import { Types } from "mongoose";
import logger from "../util/logger";
const router = Router();

export interface cartRequestBody {
  productId: string;
  quantity: number;
}

router.post(
  "/",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("name", "name is required").exists().run(req);
    await check("level", "level is required").exists().run(req);
    await check("displayType", "displayType is required").exists().run(req);
    await check("options", "options is required").isArray().run(req);
    await check("categoryId", "categoryId must be a mongoId")
      .optional()
      .customSanitizer(mongoID)
      .run(req);
    await apiValidation(req, res);

    try {
      const { name, level, displayType, categoryId = "", options } = req.body;
      const postObj: IAttribute = {
        name,
        level,
        displayType,
        options,
      };
      const nameCond = new RegExp(name, "i");
      const cond: any = {
        name: nameCond,
        level,
      };
      if (categoryId) {
        postObj.category = categoryId;
        cond["category"] = categoryId;
      }
      const result = await attributeService.find(cond);

      if (result.data.length !== 0 && level === Level.CATEGORY) {
        console.log(result.data);
        const attribute = await result.data[0].populate("category");
        throw new Error(
          `attribute with name ${name} already exists for ${attribute.category.name} category`
        );
      }
      const response = await attributeService.create(postObj);
      apiOk(res, response);
    } catch (error) {
      logger.debug(error);
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/",
  Authorize([Roles.ADMIN, Roles.VIEWER]),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("page", "page must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("perPage", "perPage must be an integer greater than 0")
      .optional()
      .isInt({ gt: 0 })
      .run(req);
    await check("categoryId", "categoryId must be a mongoId")
      .optional()
      .customSanitizer(mongoID)
      .run(req);
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const categoryId = req.query.category;
    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    let cond = {};
    if (categoryId) {
      cond = {
        category: categoryId,
      };
    }
    const result = await attributeService.find(cond, page, perPage, []);

    apiOk(res, result);
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

    const Id: string = req.params.id;
    const result = await attributeService.delete(Id);
    apiOk(res, result);
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
      const result = await attributeService.findById(req.params.id, [
        { path: "category", select: "name category" },
      ]);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

router.put(
  "/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    // await check("name", "name is required").exists().run(req);
    // await check("displayType", "displayType is required").exists().run(req);
    // await check("options", "options is required").isArray().run(req);
    await apiValidation(req, res);

    try {
      const id = req.params.id as string;
      const { name, displayType, options } = req.body;
      const editObj: Partial<IAttribute> = {};
      if (name) {
        editObj.name = name;
      }
      if (displayType) {
        editObj.displayType = displayType;
      }
      if (options) {
        editObj.options = options;
      }
      const response = await attributeService.update(id, editObj);
      apiOk(res, response);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
