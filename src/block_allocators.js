// A class that handles allocation of one block at a time
class SingleBlockAllocator {
    constructor(heap, blockSize) {
        this.heap = heap;
        this.blockSize = blockSize;
        this.totalBlockCount = Math.floor(this.heap.length / blockSize);
        this.freeBlockIndex = 0;
    };

    Allocate() {
        if (this.freeBlockIndex >= this.totalBlockCount) {
            throw 'no available blocks...';
        }

        let block = new this.heap.constructor(this.heap.buffer, this.heap.byteOffset + this.heap.BYTES_PER_ELEMENT * this.freeBlockIndex++ * this.blockSize, this.blockSize);
        return block;
    }

    Free(block) {
        if (block === null)
            return;        
        this.freeBlockIndex--;
    }
}

// A class that handles allocation of multiple non-contiguous blocks across a heap
class BlockAllocator {
    constructor(heap, blockSize) {
        this.heap = heap;
        this.blockSize = blockSize;
        this.totalBlockCount = Math.floor(this.heap.length / blockSize);
            
        this.freeBlockIndex = 0;
        this.freeBlocks = new Float64Array(this.totalBlockCount);
        for (let i = 0; i < this.totalBlockCount; i++) {
            this.freeBlocks[i] = i * blockSize;
        }
    };

    Allocate(blockCount) {
        if (blockCount + this.freeBlockIndex > this.totalBlockCount) {
            throw 'no available blocks...';
        }

        let blocks = new Array(blockCount);
        for (let i = 0; i < blocks.length; i++) {
            blocks[i] = new this.heap.constructor(this.heap.buffer, this.heap.byteOffset + this.heap.BYTES_PER_ELEMENT * this.freeBlocks[this.freeBlockIndex++], this.blockSize);
        }

        return blocks;
    }

    Free(blocks) {
        if (blocks === null)
            return;

        for (let i = blocks.length - 1 ; i >= 0; i--) {
            this.freeBlocks[--this.freeBlockIndex] = blocks[i].byteOffset / this.heap.BYTES_PER_ELEMENT;
        }
        blocks.length = 0;
    }
}

export {
    SingleBlockAllocator,
    BlockAllocator
};