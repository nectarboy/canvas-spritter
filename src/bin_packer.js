class BinPacker {
    static PackBoxes(boxes, dimension) {
        boxes.sort((b, a) => { return a.w*a.h - b.w*b.h });

        let x = 0;
        let y = 0;
        let largestHInRow = 0;

        for (let i = 0; i < boxes.length; i++) {

            let box = boxes[i];
            box.x = x;
            box.y = y;

            if (box.x + box.w > dimension) {
                y += largestHInRow;
                if (y + box.h > dimension) {
                    console.log("BIN PACK FAILED");
                    return boxes;
                }
                x = box.w;
                box.x = 0;
                box.y = y;
                largestHInRow = 0;
            }
            else {
                x += box.w;
            }

            largestHInRow = Math.max(largestHInRow, box.h);
        }

        return boxes;
    }

    static DrawBinPack(boxes, dimension) {
        let canvas = document.getElementById('binpackcanvas');
        let sx = canvas.width / dimension;
        let sy = canvas.height / dimension;
        let ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < boxes.length; i++) {
            let box = boxes[i];
            ctx.strokeRect(box.x * sx, box.y * sy, box.w * sx, box.h * sy);
            if (box.w * sx > 32 && box.h * sy > 32)
            ctx.fillText(box.w + 'x' + box.h, (box.x + box.w/2) * sx, (box.y + box.h/2) * sy);
        }
    }

    static Test() {
        const dimension = 2048;

        let boxes = [];
        for (let i = 0; i < 20; i++) {
            boxes.push({
                x: 0,
                y: 0,
                w: 0|((Math.random() * 32 + 32) * i / 2),
                h: 0|((Math.random() * 32 + 32) * i / 2)
            });
        }

        BinPacker.DrawBinPack(BinPacker.PackBoxes(boxes, dimension), dimension);
    }
}

export default BinPacker;