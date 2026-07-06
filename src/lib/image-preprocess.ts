export function cropImageFileTopHalf(file: File, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth;
        const sourceHeight = Math.floor(image.naturalHeight / 2);
        if (sourceWidth <= 0 || sourceHeight <= 0) {
          reject(new Error("invalid-image-size"));
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas-not-supported"));
          return;
        }

        context.fillStyle = "#fff";
        context.fillRect(0, 0, sourceWidth, sourceHeight);
        context.drawImage(
          image,
          0,
          0,
          sourceWidth,
          sourceHeight,
          0,
          0,
          sourceWidth,
          sourceHeight
        );
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("crop-failed"));
              return;
            }
            resolve(new File([blob], fileName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image-load-failed"));
    };
    image.src = url;
  });
}
