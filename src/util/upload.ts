// import multer from "multer";
// import fs from "fs";

// export const multerUpload = multer({ dest: "data/uploads/" });

// export const readFileFromStream = async (path: string): Promise<string> => {
//         const chunks: Array<Uint8Array> = [];
//         const promise = new Promise<Buffer>((res, rej) => {
//                 const rs = fs.createReadStream(path);
//                 rs.on("error", (err) => {
//                         return rej(err);
//                 });

//                 rs.on("data", chunk => {
//                         chunks.push(chunk);
//                 });

//                 rs.on("close", () => {
//                         return res(Buffer.concat(chunks));
//                 });
//         });

//         const data = await promise;
//         const res = data.toString("utf8");
//         return res;
// };

// export const deleteFile = async (path: string) => {
//         const promise = new Promise<void>((res, rej) => {
//                 fs.lstat(path, (err, stats) => {
//                         if(err){
//                                 return rej(err);
//                         }

//                         if (!stats.isFile()) {
//                                 throw new Error("Can only delete files");
//                         }

//                         fs.unlink(path, (err) => {
//                                 if (err) {
//                                         return rej(err);

//                                 }

//                                 return res();
//                         });
//                 });
//         });

//         return promise;
// };