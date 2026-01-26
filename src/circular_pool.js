// A circular pool factory that doesn't care to check if an object is in use or not.
function MakeCircularPoolConstructor(classCtor, size) {
    const CTOR = classCtor;
    const SIZE = size;

    let circularPoolConstructor = class {
        constructor() {
            this.index = 0;
            this.size = SIZE;
            this.buffer = new Array(SIZE);
            for (let i = 0; i < SIZE; i++)
                this.buffer[i] = new CTOR();
        }

        Get() {
            this.index = (this.index === this.size) ? 0 : this.index;
            return this.buffer[this.index++];
        }

        Release(obj) {
            obj.Reset();
        }
    }

    return circularPoolConstructor;
}

export default MakeCircularPoolConstructor;