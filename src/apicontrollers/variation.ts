import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import { Authenticate, Authorize } from "../config/auth";
import { mongoID } from "../util/apiValidation";
import { variationService } from "../services/variation";
import { Roles } from "../models/Roles";
import { IAttribute } from "../models/attribute";

const router = Router();

export interface cartRequestBody {
  productId: string;
  quantity: number;
}

router.post(
  "/",
  Authenticate(),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("attributes", "attributes is required").isArray().run(req);

    await apiValidation(req, res);

    try {
      const { attributes } = req.body;
      const response = await variationService.createVarition(attributes);
      apiOk(res, response);
    } catch (error) {
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
    apiValidation(req, res);

    let page = req.query.page || 1;
    let perPage = req.query.perPage || 10;
    const populateProducts = req.query.populateProducts || false;
    page = parseInt(page as string);
    perPage = parseInt(perPage as string);
    let populate: string[] = [];
    if (populateProducts === "true") {
      populate = ["products"];
    }
    const result = await variationService.find({}, page, perPage, populate);

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
    const result = await variationService.delete(Id);
    apiOk(res, result);
  })
);
router.post(
  "/addNewAttributes/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required")
      .exists()
      .customSanitizer(mongoID)
      .run(req);
    apiValidation(req, res);

    const Id: string = req.params.id;
    const attributes = req.body.attributes;
    const result = await variationService.addNewAttributes(Id, attributes);
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
      const populate: any = [
        { path: "attributes.attribute", select: "name displayType" },
        { path: "attributes.values.products", select: "name properties" },
      ];
      const populateProducts = req.query.populateProducts || false;
      if (populateProducts === "true") {
        populate.push("products");
      }
      const result = await variationService.findById(req.params.id, populate);
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
