class BinPacker {
    static PackBoxes(boxes, dimension) {
        let sBoxes = boxes.toSorted((b, a) => { return a.h - b.h });

        console.time('binpack');        

        let x = 0;
        let rowPartitions = [];
        let rowEndPartitions = []; // keep track of all partitions at the end of each row, they are always relevant
        let nextRowPartitions = [];

        for (let i = 0; i < sBoxes.length; i++) {

            let box = sBoxes[i];

            let y = 0;
            for (let i = 0; i < rowPartitions.length; i++) {
                if (x < rowPartitions[i].x) {
                    y = rowPartitions[i].y;
                    break;
                }
            }
            // if ahead of all row partitions, check all the end row partitions
            if (y === 0) {
                for (let i = rowEndPartitions.length - 1; i >= 0; i--) {
                    if (x < rowEndPartitions[i].x) {
                        y = rowEndPartitions[i].y;
                        break;
                    }
                }
            }

            box.x = x;
            box.y = y;

            if (box.x + box.w > dimension) {
                if (nextRowPartitions.length === 0 || nextRowPartitions[0].y + box.h > dimension) {
                    console.log("BIN PACK FAILED");
                    console.timeEnd('binpack');
                    return boxes;
                }
                x = 0;
                box.x = 0;
                box.y = nextRowPartitions[0].y;

                rowPartitions = nextRowPartitions;
                rowEndPartitions.push(nextRowPartitions[nextRowPartitions.length-1]);
                nextRowPartitions = [];
            }

            x += box.w;
            nextRowPartitions.push({
                x: x,
                y: box.y + box.h
            });
        }

        console.timeEnd('binpack');

        return boxes;
    }

    static DrawBinPack(boxes, dimension) {
        if (boxes === null)
            return;

        let canvas = document.getElementById('binpackcanvas');
        let sx = canvas.width / dimension;
        let sy = canvas.height / dimension;
        let ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < boxes.length; i++) {
            let box = boxes[i];
            ctx.strokeRect(box.x * sx, box.y * sy, box.w * sx, box.h * sy);
            // if (box.w * sx > 16 && box.h * sy > 16)
                ctx.fillText(i + ' ' + Math.max(box.w, box.h), (box.x + box.w/2) * sx, (box.y + box.h/2) * sy);
        }
    }

    static Test() {
        const dimension = 4096;

        function foo(i) {
            return Math.max(5*(Math.random() * 25 + 25) / (0.1 + i*0.04), 32);
        }

        let boxes = [];
        for (let i = 0; i < 256; i++) {
            boxes.push({
                x: -1,
                y: -1,
                w: 0|foo(i),
                h: 0|foo(i)
            });
        }

        // boxes = JSON.parse(testcase1);

        console.log(boxes);

        BinPacker.DrawBinPack(BinPacker.PackBoxes(boxes, dimension), dimension);
    }
}

const testcase1 = '[{"x":0,"y":0,"w":1776,"h":2342},{"x":1776,"y":0,"w":1385,"h":1322},{"x":3161,"y":0,"w":735,"h":1057},{"x":0,"y":2342,"w":977,"h":1015},{"x":977,"y":2342,"w":640,"h":745},{"x":1617,"y":2342,"w":691,"h":673},{"x":2308,"y":1322,"w":607,"h":495},{"x":2915,"y":1322,"w":406,"h":449},{"x":3321,"y":1057,"w":434,"h":422},{"x":0,"y":3357,"w":509,"h":386},{"x":509,"y":3357,"w":263,"h":383},{"x":772,"y":3357,"w":445,"h":357},{"x":1217,"y":3087,"w":294,"h":312},{"x":1511,"y":3087,"w":235,"h":294},{"x":1746,"y":3015,"w":325,"h":263},{"x":2071,"y":3015,"w":273,"h":263},{"x":2344,"y":1817,"w":262,"h":258},{"x":2606,"y":1817,"w":336,"h":253},{"x":2942,"y":1771,"w":252,"h":242},{"x":3194,"y":1771,"w":184,"h":235},{"x":3378,"y":1479,"w":327,"h":224},{"x":3705,"y":1479,"w":120,"h":203},{"x":3825,"y":0,"w":171,"h":192},{"x":0,"y":3743,"w":131,"h":186},{"x":131,"y":3743,"w":114,"h":185},{"x":245,"y":3743,"w":169,"h":171},{"x":414,"y":3743,"w":156,"h":167},{"x":570,"y":3740,"w":266,"h":162},{"x":836,"y":3714,"w":145,"h":160},{"x":981,"y":3714,"w":108,"h":149},{"x":1089,"y":3714,"w":122,"h":138},{"x":1211,"y":3714,"w":112,"h":135},{"x":1323,"y":3399,"w":107,"h":135},{"x":1430,"y":3399,"w":70,"h":122},{"x":1500,"y":3399,"w":151,"h":119},{"x":1651,"y":3381,"w":132,"h":109},{"x":1783,"y":3278,"w":123,"h":109},{"x":1906,"y":3278,"w":66,"h":107},{"x":1972,"y":3278,"w":94,"h":103},{"x":2066,"y":3278,"w":114,"h":102},{"x":2180,"y":3278,"w":58,"h":102},{"x":2238,"y":3278,"w":97,"h":101},{"x":2335,"y":3278,"w":163,"h":100},{"x":2498,"y":2075,"w":63,"h":99},{"x":2561,"y":2075,"w":111,"h":96},{"x":2672,"y":2070,"w":143,"h":94},{"x":2815,"y":2070,"w":110,"h":94},{"x":2925,"y":2070,"w":114,"h":93},{"x":3039,"y":2013,"w":114,"h":92},{"x":3153,"y":2013,"w":79,"h":90},{"x":3232,"y":2006,"w":55,"h":90},{"x":3287,"y":2006,"w":81,"h":88},{"x":3368,"y":2006,"w":60,"h":87},{"x":3428,"y":1703,"w":85,"h":86},{"x":3513,"y":1703,"w":58,"h":85},{"x":3571,"y":1703,"w":76,"h":83},{"x":3647,"y":1703,"w":73,"h":82},{"x":3720,"y":1682,"w":67,"h":80},{"x":3787,"y":1682,"w":121,"h":75},{"x":3908,"y":192,"w":61,"h":75},{"x":3969,"y":192,"w":87,"h":74},{"x":0,"y":3929,"w":93,"h":74},{"x":93,"y":3929,"w":69,"h":73},{"x":162,"y":3928,"w":92,"h":72},{"x":254,"y":3914,"w":56,"h":71},{"x":310,"y":3914,"w":78,"h":70},{"x":388,"y":3914,"w":76,"h":69},{"x":464,"y":3910,"w":55,"h":69},{"x":519,"y":3910,"w":71,"h":68},{"x":590,"y":3902,"w":58,"h":67},{"x":648,"y":3902,"w":74,"h":67},{"x":722,"y":3902,"w":93,"h":66},{"x":815,"y":3902,"w":65,"h":64},{"x":880,"y":3874,"w":74,"h":63},{"x":954,"y":3874,"w":52,"h":62},{"x":1006,"y":3863,"w":54,"h":61},{"x":1060,"y":3863,"w":57,"h":61},{"x":1117,"y":3852,"w":43,"h":60},{"x":1160,"y":3852,"w":57,"h":59},{"x":1217,"y":3849,"w":57,"h":58},{"x":1274,"y":3849,"w":62,"h":58},{"x":1336,"y":3534,"w":77,"h":57},{"x":1413,"y":3534,"w":59,"h":57},{"x":1472,"y":3521,"w":60,"h":53},{"x":1532,"y":3518,"w":44,"h":52},{"x":1576,"y":3518,"w":37,"h":52},{"x":1613,"y":3518,"w":77,"h":49},{"x":1690,"y":3490,"w":41,"h":46},{"x":1731,"y":3490,"w":45,"h":46},{"x":1776,"y":3490,"w":52,"h":45},{"x":1828,"y":3387,"w":44,"h":45},{"x":1872,"y":3387,"w":59,"h":45},{"x":1931,"y":3385,"w":56,"h":45},{"x":1987,"y":3381,"w":64,"h":44},{"x":2051,"y":3381,"w":54,"h":44},{"x":2105,"y":3380,"w":44,"h":41},{"x":2149,"y":3380,"w":39,"h":40},{"x":2188,"y":3380,"w":56,"h":40},{"x":2244,"y":3379,"w":52,"h":38},{"x":2296,"y":3379,"w":66,"h":37}]'

export default BinPacker;