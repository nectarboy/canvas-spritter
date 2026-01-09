async function GetSpritterImage(url, name, fullyOpaque = false) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = url;

        img.onload = () => {
            let spritterImage = new SpritterImage(img, name, fullyOpaque);
            resolve(spritterImage);
        }
        img.onerror = (e) => reject(e);
    });
}

class SpritterImage {
    constructor(img, name, fullyOpaque) {
        this.name = name;
        this.img = img;
        this.fullyOpaque = fullyOpaque;
        if (!fullyOpaque) {
            this.CheckIfFullyOpaque();
        }
    };

    CheckIfFullyOpaque() {
        console.time('CheckIfFullyOpaque');

        let canvas = new OffscreenCanvas(this.img.width, this.img.height);
        let ctx = canvas.getContext('2d');
        ctx.drawImage(this.img, 0, 0, this.img.width, this.img.height);

        this.fullyOpaque = true;

        let imageData = ctx.getImageData(0, 0, this.img.width, this.img.height);
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] < 0xff) {
                this.fullyOpaque = false;
                break;
            }
        }

        console.timeEnd('CheckIfFullyOpaque');
    }
}

export default GetSpritterImage;