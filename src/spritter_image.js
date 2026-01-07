async function FetchImage(url, name) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = url;

        img.onload = () => {
            let spritterImage = new SpritterImage(img, name);
            resolve(spritterImage);
        }
        img.onerror = (e) => reject(e);
    });
}

class SpritterImage {
    constructor(img, name) {
        this.name = '';
        this.img = null;
        this.fullyOpaque = false;
        this.CheckIfFullyOpaque();
    };

    CheckIfFullyOpaque() {
        let canvas = new OffscreenCanvas(this.img.width, this.img.height);
        let ctx = canvas.getContext('2d');
        ctx.drawImage(this.img, 0, 0, this.img.width, this.img.height);

        let imageData = ctx.getImageData(0, 0, this.img.width, this.img.height);
        // ...
    }
}

export default SpritterImage;