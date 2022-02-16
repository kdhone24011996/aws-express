import { NextFunction, Request, Router, Response } from "express";
import { apiError, apiOk, apiValidation, catchAsync } from "../util/apiHelpers";
import { check } from "express-validator";
import logger from "../util/logger";
import { Authenticate, Authorize } from "../config/auth";
import { Roles } from "../models/Roles";
import { productService } from "../services/product";
import { mongoID } from "../util/apiValidation";

import { IBannerContent, IBannerImage } from "../models/cms";
import { ICms } from "../models/cms";
import { cmsService } from "../services/cms";
const router = Router();

router.post(
  "/banner",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("name", "name doesn't exists").exists().run(req);
    await check("url", "url doesn't exists").exists().run(req);
    await check("image", "image doesn't exists").exists().run(req);

    await apiValidation(req, res);
    try {
      const bannerData = req.body;
      const image = bannerData.image;
      let uploadedImage: IBannerImage;
      const mobile = await cmsService.uploadBannerImage(image.mobile);
      const desktop = await cmsService.uploadBannerImage(image.desktop);
      if (!mobile || !desktop) {
        throw new Error("File upload failed");
      }

      uploadedImage = {
        mobile,
        desktop,
      };
      const banner: IBannerContent = {
        image: uploadedImage,
        name: bannerData.name,
        url: bannerData.url,
      };

      let alreadyUploadedBanners: IBannerContent[] = [];
      const result = await cmsService.find({});
      let cms;
      if (result.data.length > 0) {
        cms = result.data[0];
        alreadyUploadedBanners = [...cms.banner];
      }
      const data: ICms = {
        banner: [...alreadyUploadedBanners, banner],
      };
      let response;
      if (cms) {
        response = await cms.update(data);
      } else {
        response = await cmsService.create(data);
      }
      apiOk(res, response);
      // res.send(re);
    } catch (error) {
      console.log("hello");
      apiError(res, error, 500);
    }
  })
);
router.put(
  "/banner/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("url", "url doesn't exists").exists().run(req);
    await check("image", "image doesn't exists").exists().run(req);
    await check("name", "name doesn't exists").exists().run(req);

    await apiValidation(req, res);
    try {
      const id = req.params.id;
      const response = await cmsService.find({});
      if (response.data.length === 0) {
        throw new Error("cms does not exits");
      }

      const cms = response.data[0];
      console.log(cms.banner);
      const idx = cms.banner.findIndex((item) => item._id.toString() === id);
      if (idx === -1) {
        throw new Error(`banner with id ${id} does not exits`);
      }
      const bannerData = req.body;

      const image = bannerData.image;
      let uploadedImage: IBannerImage;
      const mobile = await cmsService.uploadBannerImage(image.mobile);
      const desktop = await cmsService.uploadBannerImage(image.desktop);
      if (!mobile || !desktop) {
        throw new Error("File upload failed");
      }

      uploadedImage = {
        mobile,
        desktop,
      };
      const banner: IBannerContent = {
        image: uploadedImage,
        name: bannerData.name,
        url: bannerData.url,
      };

      cms.banner[idx] = banner;
      const result = await cms.save();
      apiOk(res, result);
      // res.send(re);
    } catch (error) {
      console.log("hello");
      apiError(res, error, 500);
    }
  })
);

router.get(
  "/banner",
  // Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await cmsService.find({});
      apiOk(res, response);
      // res.send(re);
    } catch (error) {
      console.log("hello");
      apiError(res, error, 500);
    }
  })
);

router.delete(
  "/banner/:id",
  Authorize(Roles.ADMIN),
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await check("id", "id is required").exists().run(req);
    apiValidation(req, res);

    const key = req.body.key;
    const id = await req.params.id;
    try {
      const response = await cmsService.find({});
      if (response.data.length === 0) {
        throw new Error("cms does not exits");
      }

      const cms = response.data[0];
      console.log(cms.banner);
      const idx = cms.banner.findIndex((item) => item._id.toString() === id);
      if (idx === -1) {
        throw new Error(`banner with name ${name} does not exits`);
      }
      const restBanners = cms.banner.filter(
        (item) => item._id.toString() !== id
      );
      cms.banner = restBanners;
      const result = await cms.save();
      apiOk(res, result);
    } catch (error) {
      apiError(res, error, 500);
    }
  })
);

export default router;
